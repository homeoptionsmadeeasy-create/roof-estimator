(() => {
  const $ = (s) => document.querySelector(s);
  const S = window.RQShared;
  const state = { cfg: null, mode: 'server', sessionId: null, found: false, confirmed: true, roof: null, answers: {} };
  const stepNo = { address: 1, loading: 1, confirm: 2, nocoverage: 2, questions: 3, contact: 4, result: 5 };
  const money = (n) => '$' + Math.round(n).toLocaleString('en-US');
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  // ------------------------------------------------------------------
  // API layer. "server" mode talks to server.js. "local" mode runs the exact
  // same formula in the browser with a sample roof, so the page works when
  // opened straight from a folder or as a hosted preview, with no setup.
  // ------------------------------------------------------------------
  async function post(url, body) {
    const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data.error || 'Something went wrong. Please try again.');
    return data;
  }

  const local = {
    sessions: {},
    publicConfig() {
      const c = window.RQ_DEMO_DATA.config;
      return {
        branding: c.branding,
        materials: c.materials.filter((m) => m.enabled).map(({ id, name, description }) => ({ id, name, description })),
        financing: !!c.financing?.enabled, showLineItems: !!c.display?.showLineItems, demo: true,
      };
    },
    async measure(address) {
      if (address.length < 6) throw new Error('Please enter your full street address.');
      const c = window.RQ_DEMO_DATA.config;
      const m = S.normalize(window.RQ_DEMO_DATA.building, null, c.measurement);
      const id = Math.random().toString(36).slice(2);
      const parts = address.split(',').map((p) => p.trim());
      const stZip = (parts[2] || '').split(/\s+/);
      this.sessions[id] = { measurement: m, address: { full: address, street: parts[0] || address, city: parts[1] || '', state: stZip[0] || '', zip: stZip[1] || '' } };
      await new Promise((r) => setTimeout(r, 900));
      return {
        sessionId: id, found: true, address,
        roof: { totalAreaSqFt: m.totalAreaSqFt, facets: m.facets, predominantPitch: m.predominantPitch, estStories: m.estStories, quality: m.quality },
        imageUrl: 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(S.mockSvg(m)),
      };
    },
    async lead(b) {
      const c = window.RQ_DEMO_DATA.config;
      const s = this.sessions[b.sessionId];
      const ct = b.contact;
      if (!ct.firstName || !/^\S+@\S+\.\S+$/.test(ct.email) || String(ct.phone).replace(/\D/g, '').length < 10) {
        throw new Error('Please enter your name, a valid email, and a 10-digit phone number.');
      }
      if (!b.consent) throw new Error('Please check the consent box to receive your estimate.');
      const m = s.measurement, use = b.confirmed !== false;
      const quote = use ? S.computeQuote(m, b.answers, c) : null;
      const comparisons = use && c.display?.compareAllMaterials ? S.quoteAllMaterials(m, b.answers, c) : [];
      const testLead = {
        createdAt: new Date().toISOString(), firstName: ct.firstName, lastName: ct.lastName, email: ct.email, phone: ct.phone,
        address: s.address, answers: b.answers, notes: b.notes,
        roof: { totalAreaSqFt: m.totalAreaSqFt, facets: m.facets, predominantPitch: m.predominantPitch, quality: m.quality, imageryDate: m.imageryDate },
        quote: quote && { low: quote.low, high: quote.high, mid: quote.mid, squares: quote.squares, materialName: quote.materialName, lines: quote.lines },
        needsManualMeasure: !use, utm: b.utm,
      };
      return {
        quote: quote && (c.display?.showLineItems ? quote : { ...quote, lines: undefined }),
        comparisons: comparisons.map((q) => ({ materialId: q.materialId, materialName: q.materialName, low: q.low, high: q.high })),
        needsManualMeasure: !use, testLead,
      };
    },
  };

  const api = {
    publicConfig: () => (state.mode === 'local' ? local.publicConfig() : fetch('api/public-config').then((r) => { if (!r.ok) throw 0; return r.json(); })),
    measure: (address) => (state.mode === 'local' ? local.measure(address) : post('api/measure', { address })),
    lead: (body) => (state.mode === 'local' ? local.lead(body) : post('api/lead', body)),
  };

  // ------------------------------------------------------------------
  function show(step) {
    document.querySelectorAll('.step').forEach((el) => el.classList.toggle('active', el.dataset.step === step));
    const n = stepNo[step];
    document.querySelectorAll('.rq-steps li').forEach((li) => {
      const i = Number(li.dataset.s);
      li.className = i < n ? 'done' : i === n ? 'now' : '';
    });
    if (step !== 'address') {
      const first = document.querySelector(`.step[data-step="${step}"] h2, .step[data-step="${step}"] button`);
      if (first) { first.setAttribute('tabindex', '-1'); first.focus({ preventScroll: true }); }
    }
    if (window.parent !== window) document.querySelector('.rq').scrollIntoView({ block: 'nearest' });
    resize();
  }
  function resize() {
    if (window.parent !== window) window.parent.postMessage({ type: 'roof-quote:height', height: document.documentElement.scrollHeight }, '*');
  }
  if (window.ResizeObserver) new ResizeObserver(resize).observe(document.body);

  function utm() {
    const p = new URLSearchParams(location.search), out = {};
    for (const k of ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'gclid', 'fbclid']) if (p.get(k)) out[k] = p.get(k);
    return out;
  }

  async function init() {
    let cfg;
    if (location.protocol === 'file:' || window.RQ_FORCE_LOCAL) state.mode = 'local';
    try { cfg = await api.publicConfig(); }
    catch { state.mode = 'local'; cfg = await api.publicConfig(); }
    state.cfg = cfg;

    const b = cfg.branding;
    const root = document.documentElement.style;
    if (b.primaryColor) root.setProperty('--brand', b.primaryColor);
    if (b.accentColor) { root.setProperty('--accent', b.accentColor); }
    $('#headline').textContent = b.headline || '';
    $('#headline-accent').textContent = b.headlineAccent || '';
    $('#subheadline').textContent = b.subheadline || '';
    $('#trust-bar').innerHTML = (b.trustItems || []).map((t) => `<span>${esc(t)}</span>`).join('');
    $('#wordmark').textContent = b.companyName;
    if (b.logoUrl) {
      const img = $('#logo');
      img.onload = () => { img.hidden = false; $('#wordmark').hidden = true; };
      img.onerror = () => { img.hidden = true; $('#wordmark').hidden = false; };
      img.alt = b.companyName; img.src = b.logoUrl;
    }
    const tel = 'tel:' + (b.phone || '').replace(/[^\d+]/g, '');
    $('#head-phone').textContent = b.phone || ''; $('#head-phone').href = tel;
    $('#phone').textContent = b.phone || ''; $('#phone').href = tel;
    $('#consent-text').textContent = b.consentText;
    $('#disclaimer').textContent = b.disclaimer;
    $('#cta').textContent = b.ctaText; $('#cta').href = b.ctaUrl;
    $('#fin-wrap').hidden = !cfg.financing;
    document.title = `Instant Roof Estimate | ${b.companyName}`;
    $('#materials').innerHTML = cfg.materials.map((m, i) => `
      <label><input type="radio" name="materialId" value="${esc(m.id)}" ${i === 0 ? 'checked' : ''}>
      <span class="card"><b>${esc(m.name)}</b><small>${esc(m.description || '')}</small></span></label>`).join('');

    if (cfg.demo) {
      $('#demo-banner').hidden = false;
      $('#demo-banner').textContent = state.mode === 'local'
        ? 'Test mode: running in your browser with a sample roof. Prices use the default formula; nothing is sent anywhere.'
        : 'Test mode: no Google API key yet, so every address uses a sample roof. Leads are still saved and sent to your CRM.';
    }
    const prefill = new URLSearchParams(location.search).get('address');
    if (prefill) $('#address').value = prefill;
    show('address');
  }

  // Step 1 – address
  const loadingMsgs = ['Locating the property', 'Finding every roof plane', 'Measuring pitch and area'];
  $('#f-address').addEventListener('submit', async (e) => {
    e.preventDefault();
    $('#err-address').textContent = '';
    const address = $('#address').value.trim();
    show('loading');
    let i = 0; const tick = setInterval(() => { $('#loading-msg').textContent = loadingMsgs[++i % loadingMsgs.length]; }, 700);
    try {
      const [d] = await Promise.all([api.measure(address), new Promise((r) => setTimeout(r, 1200))]);
      state.sessionId = d.sessionId; state.found = d.found; state.roof = d.roof;
      if (!d.found) { state.confirmed = false; return show('nocoverage'); }
      $('#confirm-address').textContent = d.address;
      $('#roof-img').src = d.imageUrl;
      $('#s-area').textContent = d.roof.totalAreaSqFt.toLocaleString('en-US');
      $('#s-facets').textContent = d.roof.facets;
      $('#s-pitch').textContent = d.roof.predominantPitch;
      const st = document.querySelector(`input[name=stories][value="${Math.min(3, d.roof.estStories || 1)}"]`);
      if (st) st.checked = true;
      show('confirm');
    } catch (err) {
      show('address');
      $('#err-address').textContent = err.message;
    } finally { clearInterval(tick); $('#loading-msg').textContent = loadingMsgs[0]; }
  });

  // Step 2 – confirm
  $('#yes-roof').onclick = () => { state.confirmed = true; show('questions'); };
  $('#no-roof').onclick = () => { state.confirmed = false; show('nocoverage'); };
  $('#nocov-continue').onclick = () => show('questions');
  document.addEventListener('click', (e) => { const b = e.target.closest('[data-back]'); if (b) show(b.dataset.back); });

  // Step 3 – questions
  $('#f-questions').addEventListener('submit', (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    state.answers = Object.fromEntries(f.entries());
    state.answers.financing = f.get('financing') === 'on';
    const manual = !state.found || !state.confirmed;
    $('#contact-title').textContent = manual ? 'Almost done' : 'Your estimate is ready';
    $('#contact-sub').textContent = manual ? 'Where should we send your estimate?' : "Enter your details to see your price instantly. We'll email you a copy too.";
    $('#contact-btn').textContent = manual ? 'Request my estimate →' : 'Show my price →';
    show('contact');
  });

  // Step 4 – contact → lead → quote
  $('#f-contact').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = $('#contact-btn');
    const f = new FormData(e.target);
    $('#err-contact').textContent = '';
    btn.disabled = true;
    try {
      const d = await api.lead({
        sessionId: state.sessionId,
        confirmed: state.confirmed,
        answers: state.answers,
        contact: { firstName: f.get('firstName'), lastName: f.get('lastName'), email: f.get('email'), phone: f.get('phone') },
        notes: f.get('notes'), website: f.get('website'), consent: f.get('consent') === 'on',
        utm: utm(), pageUrl: document.referrer || location.href,
      });
      renderResult(d);
      show('result');
      if (window.parent !== window) window.parent.postMessage({ type: 'roof-quote:lead', quote: d.quote ? { low: d.quote.low, high: d.quote.high } : null }, '*');
    } catch (err) {
      $('#err-contact').textContent = err.message;
    } finally { btn.disabled = false; }
  });

  function renderResult(d) {
    const manual = d.needsManualMeasure || !d.quote;
    $('#result-quote').hidden = manual;
    $('#result-manual').hidden = !manual;
    if (d.testLead) {
      $('#payload').hidden = false; $('#restart').hidden = false;
      $('#payload-json').textContent = JSON.stringify(d.testLead, null, 2);
    }
    if (manual) return;
    const q = d.quote;
    $('#r-material').textContent = `Your estimated price · ${q.materialName}`;
    $('#r-range').textContent = `${money(q.low)} – ${money(q.high)}`;
    $('#r-monthly').textContent = q.financing ? `or as low as ${money(q.financing.monthlyFrom)}/mo with financing*` : '';
    $('#r-detail').textContent = `${q.roofSqFt.toLocaleString('en-US')} sq ft of roof · ${q.squares} squares incl. waste · ${q.stories}-story · ${q.layers}-layer tear-off`;
    const t = $('#r-lines');
    t.hidden = !q.lines?.length;
    if (q.lines?.length) t.innerHTML = q.lines.map((l) => `<tr><td>${esc(l.label)}</td><td>${money(l.amount)}</td></tr>`).join('');
    $('#r-compare').innerHTML = d.comparisons?.length > 1
      ? '<h3>Compare roof options</h3>' + d.comparisons.map((c) =>
        `<div class="opt ${c.materialId === q.materialId ? 'sel' : ''}"><span>${esc(c.materialName)}</span><span>${money(c.low)} – ${money(c.high)}</span></div>`).join('')
      : '';
    $('#disclaimer').textContent = state.cfg.branding.disclaimer +
      (q.financing ? ` *Payment example based on ${q.financing.aprPercent}% APR for ${q.financing.termMonths} months on the low estimate, subject to credit approval.` : '');
  }

  $('#restart').onclick = () => {
    ['#f-address', '#f-questions'].forEach((s) => $(s).reset());
    $('#payload').hidden = true; $('#restart').hidden = true;
    show('address');
  };

  init().catch((e) => { console.error(e); document.querySelector('.rq-body').innerHTML = '<p>The estimator is temporarily unavailable. Please call us for a quote.</p>'; });
})();
