// Sends a lead to every CRM listed in CRM_PROVIDERS (comma separated), e.g. CRM_PROVIDERS=gohighlevel,webhook
const adapters = {
  webhook: require('./webhook'),
  gohighlevel: require('./gohighlevel'),
  hubspot: require('./hubspot'),
  jobnimbus: require('./jobnimbus'),
};

function enabledProviders() {
  return (process.env.CRM_PROVIDERS || '')
    .split(',').map((s) => s.trim().toLowerCase()).filter(Boolean)
    .filter((p) => adapters[p]);
}

// Plain-text summary used as the CRM note/description
function summarize(lead) {
  const q = lead.quote;
  const r = lead.roof;
  const ans = lead.answers || {};
  const lines = [
    `ONLINE ROOF ESTIMATE (${lead.source || 'website'})`,
    q ? `Estimate: $${q.low.toLocaleString()} – $${q.high.toLocaleString()} (${q.materialName})` : 'Estimate: NOT SHOWN – needs manual measurement',
    r ? `Roof: ${r.totalAreaSqFt.toLocaleString()} sq ft, ${q && !q.noTearOff ? q.squares + ' squares incl. waste, ' : ''}${r.facets} planes, predominant pitch ${r.predominantPitch}` : null,
    q?.noTearOff ? 'Service: treatment of existing shingles (no tear-off). Confirm the roof is a good candidate and check shingle warranty at inspection.' : null,
    r ? `Imagery: ${r.quality} quality, ${r.imageryDate || 'date n/a'}` : null,
    `Layers to remove: ${q?.noTearOff ? 'n/a (rejuvenation)' : ans.layers ?? 'n/a'} | Stories: ${ans.stories ?? 'n/a'} | Skylights: ${ans.skylights ?? 0} | Chimneys: ${ans.chimneys ?? 0}`,
    `Reason: ${ans.reason || 'n/a'} | Timeline: ${ans.timeline || 'n/a'} | Financing interest: ${ans.financing ? 'yes' : 'no'}`,
    lead.needsManualMeasure ? '⚠ Satellite measurement unavailable or rejected by homeowner – measure manually.' : null,
    lead.notes ? `Homeowner notes: ${lead.notes}` : null,
    lead.utm && Object.keys(lead.utm).length ? `UTM: ${Object.entries(lead.utm).map(([k, v]) => `${k}=${v}`).join(' ')}` : null,
  ];
  return lines.filter(Boolean).join('\n');
}

async function sendLead(lead) {
  const results = {};
  for (const p of enabledProviders()) {
    try {
      const out = await adapters[p].send(lead, summarize(lead));
      results[p] = { ok: true, at: new Date().toISOString(), ...out };
    } catch (e) {
      results[p] = { ok: false, at: new Date().toISOString(), error: String(e.message || e).slice(0, 500) };
      console.error(`[crm:${p}]`, e.message);
    }
  }
  return results;
}

async function http(url, opts = {}) {
  const res = await fetch(url, { ...opts, headers: { 'Content-Type': 'application/json', Accept: 'application/json', ...(opts.headers || {}) } });
  const text = await res.text();
  let body; try { body = JSON.parse(text); } catch { body = text; }
  return { status: res.status, ok: res.ok, body };
}

module.exports = { sendLead, summarize, enabledProviders, http };
