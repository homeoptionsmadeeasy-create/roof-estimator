// Generic webhook: works with Zapier, Make, n8n, AccuLynx/Leap/any CRM via automation tools.
// Env: WEBHOOK_URL, optional WEBHOOK_SECRET (adds X-Signature: sha256=<hmac of body>)
const crypto = require('crypto');

async function send(lead, summary) {
  const { http } = require('./index');
  const url = process.env.WEBHOOK_URL;
  if (!url) throw new Error('WEBHOOK_URL not set');
  const payload = JSON.stringify({
    event: 'roof_estimate_lead',
    ...lead,
    // Flattened fields make Zapier/Make mapping easy
    first_name: lead.firstName, last_name: lead.lastName, email: lead.email, phone: lead.phone,
    street: lead.address?.street, city: lead.address?.city, state: lead.address?.state, zip: lead.address?.zip,
    full_address: lead.address?.full,
    estimate_low: lead.quote?.low ?? null, estimate_high: lead.quote?.high ?? null, estimate_material: lead.quote?.materialName ?? null,
    roof_sqft: lead.roof?.totalAreaSqFt ?? null, roof_squares: lead.quote?.squares ?? null, roof_pitch: lead.roof?.predominantPitch ?? null,
    summary,
  });
  const headers = {};
  if (process.env.WEBHOOK_SECRET) {
    headers['X-Signature'] = 'sha256=' + crypto.createHmac('sha256', process.env.WEBHOOK_SECRET).update(payload).digest('hex');
  }
  const r = await http(url, { method: 'POST', body: payload, headers });
  if (!r.ok) throw new Error(`Webhook ${r.status}: ${JSON.stringify(r.body).slice(0, 200)}`);
  return { status: r.status };
}
module.exports = { send };
