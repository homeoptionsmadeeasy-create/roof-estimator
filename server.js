try { process.loadEnvFile(); } catch { /* no .env file – use real env vars */ }

const express = require('express');
const path = require('path');
const solar = require('./lib/solar');
const { computeQuote, quoteAllMaterials } = require('./lib/pricing');
const store = require('./lib/store');
const crm = require('./lib/crm');

const app = express();
app.set('trust proxy', 1);
app.use(express.json({ limit: '200kb' }));

// ---------- tiny rate limiter (per IP, per bucket) ----------
const hits = new Map();
function limit(bucket, max, windowMs) {
  return (req, res, next) => {
    const k = bucket + ':' + req.ip;
    const now = Date.now();
    const arr = (hits.get(k) || []).filter((t) => now - t < windowMs);
    if (arr.length >= max) return res.status(429).json({ error: 'Too many requests. Please try again later.' });
    arr.push(now); hits.set(k, arr); next();
  };
}

// ---------- public widget API ----------
app.get('/api/public-config', (req, res) => {
  const c = store.getConfig();
  res.json({
    branding: c.branding,
    materials: c.materials.filter((m) => m.enabled).map(({ id, name, description }) => ({ id, name, description })),
    financing: !!c.financing?.enabled,
    showLineItems: !!c.display?.showLineItems,
    demo: solar.isMock(),
  });
});

async function measureAddress(address, cfg) {
  const geo = await solar.geocode(address);
  if (!geo) return { geo: null, measurement: null, reason: 'address_not_found' };
  const insights = await solar.buildingInsights(geo.lat, geo.lng, cfg.measurement.requiredQuality);
  if (!insights) return { geo, measurement: null, reason: 'no_coverage' };
  const m = solar.normalize(insights, geo, cfg.measurement);
  if (!m.segments.length) return { geo, measurement: null, reason: 'no_roof_planes' };
  if (m.distanceFromAddressM != null && m.distanceFromAddressM > (cfg.measurement.maxDistanceFromAddressM || 40)) {
    return { geo, measurement: null, reason: 'building_too_far' };
  }
  return { geo, measurement: m };
}

app.post('/api/measure', limit('measure', 15, 3600e3), async (req, res) => {
  const address = String(req.body.address || '').trim().slice(0, 200);
  if (address.length < 6) return res.status(400).json({ error: 'Please enter your full street address.' });
  const cfg = store.getConfig();
  try {
    const { geo, measurement, reason } = await measureAddress(address, cfg);
    if (!geo) return res.status(404).json({ error: "We couldn't find that address. Please check it and try again." });
    const sessionId = store.newSession({ address: { full: geo.formatted, ...geo.components }, measurement });
    res.json({
      sessionId,
      found: !!measurement,
      reason: reason || null,
      address: geo.formatted,
      roof: measurement && {
        totalAreaSqFt: measurement.totalAreaSqFt,
        facets: measurement.facets,
        predominantPitch: measurement.predominantPitch,
        estStories: measurement.estStories,
        quality: measurement.quality,
      },
      imageUrl: measurement ? `api/roof-image/${sessionId}` : null,
    });
  } catch (e) {
    console.error('[measure]', e);
    res.status(502).json({ error: 'Our measuring service is busy. Please try again in a minute.' });
  }
});

app.get('/api/roof-image/:id', async (req, res) => {
  const s = store.getSession(req.params.id);
  if (!s?.measurement) return res.status(404).end();
  if (solar.isMock()) return res.type('image/svg+xml').send(solar.mockSvg(s.measurement));
  try {
    const r = await fetch(solar.staticMapUrl(s.measurement));
    if (!r.ok) return res.status(502).end();
    res.set('Cache-Control', 'private, max-age=3600').type(r.headers.get('content-type') || 'image/png');
    res.send(Buffer.from(await r.arrayBuffer()));
  } catch { res.status(502).end(); }
});

const clean = (v, n = 120) => String(v ?? '').trim().slice(0, n);

app.post('/api/lead', limit('lead', 8, 3600e3), async (req, res) => {
  const b = req.body || {};
  if (b.website) return res.json({ ok: true }); // honeypot – bots fill hidden fields
  const s = store.getSession(b.sessionId);
  if (!s) return res.status(400).json({ error: 'Your session expired. Please start again.' });

  const contact = b.contact || {};
  const firstName = clean(contact.firstName, 60), lastName = clean(contact.lastName, 60);
  const email = clean(contact.email, 120).toLowerCase(), phone = clean(contact.phone, 30);
  if (!firstName || !/^\S+@\S+\.\S+$/.test(email) || phone.replace(/\D/g, '').length < 10) {
    return res.status(400).json({ error: 'Please enter your name, a valid email, and a 10-digit phone number.' });
  }
  if (!b.consent) return res.status(400).json({ error: 'Please check the consent box to receive your estimate.' });

  const cfg = store.getConfig();
  const a = b.answers || {};
  const answers = {
    materialId: clean(a.materialId, 60),
    layers: clean(a.layers, 10),
    stories: clean(a.stories, 2),
    skylights: Math.min(20, parseInt(a.skylights, 10) || 0),
    chimneys: Math.min(10, parseInt(a.chimneys, 10) || 0),
    reason: clean(a.reason, 60),
    timeline: clean(a.timeline, 60),
    financing: !!a.financing,
  };

  const m = s.measurement;
  const useSatellite = m && b.confirmed !== false;
  const quote = useSatellite ? computeQuote(m, answers, cfg) : null;
  const comparisons = useSatellite && cfg.display?.compareAllMaterials ? quoteAllMaterials(m, answers, cfg) : [];

  const lead = store.addLead({
    id: store.newId(),
    createdAt: new Date().toISOString(),
    firstName, lastName, email, phone,
    address: s.address,
    answers,
    notes: clean(b.notes, 1000),
    roof: m ? { totalAreaSqFt: m.totalAreaSqFt, facets: m.facets, predominantPitch: m.predominantPitch, quality: m.quality, imageryDate: m.imageryDate } : null,
    quote: quote && { low: quote.low, high: quote.high, mid: quote.mid, squares: quote.squares, materialName: quote.materialName, lines: quote.lines },
    homeownerConfirmedRoof: m ? b.confirmed !== false : null,
    needsManualMeasure: !useSatellite,
    source: clean(b.source, 60) || 'Website roof estimator',
    utm: Object.fromEntries(Object.entries(b.utm || {}).slice(0, 8).map(([k, v]) => [clean(k, 30), clean(v, 100)])),
    pageUrl: clean(b.pageUrl, 300),
    ip: req.ip,
    crm: {},
  });

  // Respond immediately; push to CRM(s) in the background and record the result.
  const strip = (q) => q && (cfg.display?.showLineItems ? q : { ...q, lines: undefined, mid: undefined });
  res.json({
    ok: true,
    quote: strip(quote),
    comparisons: comparisons.map((q) => ({ materialId: q.materialId, materialName: q.materialName, low: q.low, high: q.high, financing: q.financing })),
    needsManualMeasure: !useSatellite,
    // In test mode (no Google key yet) show exactly what the CRM receives
    testLead: solar.isMock() ? { ...lead, ip: undefined } : undefined,
  });
  crm.sendLead(lead).then((results) => store.updateLead(lead.id, { crm: results })).catch((e) => console.error('[crm]', e));
});

// ---------- admin ----------
function adminAuth(req, res, next) {
  const pw = process.env.ADMIN_PASSWORD;
  if (!pw) return res.status(503).send('Set ADMIN_PASSWORD in your environment to enable the admin page.');
  const [scheme, token] = (req.headers.authorization || '').split(' ');
  const [, pass] = Buffer.from(token || '', 'base64').toString().split(/:(.*)/s);
  if (scheme === 'Basic' && pass === pw) return next();
  res.set('WWW-Authenticate', 'Basic realm="Roof estimator admin"').status(401).send('Authentication required');
}
app.use('/admin', adminAuth, express.static(path.join(__dirname, 'admin')));
app.use('/api/admin', adminAuth);

app.get('/api/admin/status', (req, res) => res.json({ demo: solar.isMock(), crmProviders: crm.enabledProviders() }));
app.get('/api/admin/config', (req, res) => res.json(store.getConfig()));
app.put('/api/admin/config', (req, res) => {
  const cfg = req.body;
  try {
    // Validate by running the formula against the sample roof
    const sample = solar.normalize(require('./data/mock-building.json'), null, cfg.measurement);
    const q = computeQuote(sample, { materialId: cfg.materials[0]?.id, layers: '1', stories: '1' }, cfg);
    if (!Number.isFinite(q.low) || !Number.isFinite(q.high)) throw new Error('Formula produced an invalid number – check for blank fields.');
    if (!cfg.materials.some((m) => m.enabled)) throw new Error('Enable at least one material.');
    store.saveConfig(cfg);
    res.json({ ok: true });
  } catch (e) { res.status(400).json({ error: e.message }); }
});
app.post('/api/admin/config/reset', (req, res) => res.json(store.resetConfig()));

app.post('/api/admin/test-quote', async (req, res) => {
  const cfg = req.body.config || store.getConfig();
  try {
    let m, address = null;
    if (req.body.address) {
      const r = await measureAddress(req.body.address, cfg);
      if (!r.measurement) return res.status(404).json({ error: `No measurement: ${r.reason}` });
      m = r.measurement; address = r.geo.formatted;
    } else {
      m = solar.normalize(require('./data/mock-building.json'), null, cfg.measurement);
    }
    res.json({ address, measurement: { ...m, segments: m.segments.map(({ box, ...s }) => s) }, quotes: quoteAllMaterials(m, req.body.answers || {}, cfg) });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

app.get('/api/admin/leads', (req, res) => res.json(store.readLeads()));
app.post('/api/admin/leads/:id/resend', async (req, res) => {
  const lead = store.readLeads().find((l) => l.id === req.params.id);
  if (!lead) return res.status(404).json({ error: 'not found' });
  const results = await crm.sendLead(lead);
  res.json(store.updateLead(lead.id, { crm: results }));
});
app.get('/api/admin/leads.csv', (req, res) => {
  const cols = ['createdAt', 'firstName', 'lastName', 'email', 'phone', 'address.full', 'quote.low', 'quote.high', 'quote.materialName', 'roof.totalAreaSqFt', 'roof.predominantPitch', 'answers.reason', 'answers.timeline', 'needsManualMeasure'];
  const get = (o, p) => p.split('.').reduce((x, k) => (x == null ? x : x[k]), o);
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const csv = [cols.join(','), ...store.readLeads().map((l) => cols.map((c) => esc(get(l, c))).join(','))].join('\n');
  res.type('text/csv').set('Content-Disposition', 'attachment; filename="roof-leads.csv"').send(csv);
});

// ---------- widget ----------
// demo-data.js powers the browser-only test mode (opening index.html from a folder).
// When the real server is running it isn't needed, so don't publish the pricing config.
app.get('/demo-data.js', (req, res) => res.type('application/javascript').send('window.RQ_DEMO_DATA = null;'));
app.use(express.static(path.join(__dirname, 'public')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Roof estimator running on http://localhost:${PORT}`);
  console.log(`  Widget: http://localhost:${PORT}/   Admin: http://localhost:${PORT}/admin/`);
  if (solar.isMock()) console.log('  DEMO MODE: no GOOGLE_API_KEY set – using a sample roof for every address.');
  console.log(`  CRM providers: ${crm.enabledProviders().join(', ') || '(none – leads saved locally only)'}`);
});
