// GoHighLevel (LeadConnector API v2) – upserts the contact, adds a note, optionally opens an opportunity.
// Env: GHL_TOKEN (Private Integration token), GHL_LOCATION_ID, optional GHL_PIPELINE_ID + GHL_STAGE_ID, GHL_TAGS
const BASE = 'https://services.leadconnectorhq.com';

async function send(lead, summary) {
  const { http } = require('./index');
  const token = process.env.GHL_TOKEN, locationId = process.env.GHL_LOCATION_ID;
  if (!token || !locationId) throw new Error('GHL_TOKEN / GHL_LOCATION_ID not set');
  const headers = { Authorization: `Bearer ${token}`, Version: '2021-07-28' };
  const tags = (process.env.GHL_TAGS || 'online-estimate').split(',').map((t) => t.trim()).filter(Boolean);
  if (lead.needsManualMeasure) tags.push('needs-manual-measure');
  if (lead.quote?.materialId) tags.push(`estimate-${lead.quote.materialId}`);

  const c = await http(`${BASE}/contacts/upsert`, {
    method: 'POST', headers,
    body: JSON.stringify({
      locationId, firstName: lead.firstName, lastName: lead.lastName, email: lead.email, phone: lead.phone,
      address1: lead.address?.street, city: lead.address?.city, state: lead.address?.state, postalCode: lead.address?.zip,
      source: lead.source || 'Website roof estimator', tags,
    }),
  });
  if (!c.ok) throw new Error(`GHL contact ${c.status}: ${JSON.stringify(c.body).slice(0, 200)}`);
  const contactId = c.body?.contact?.id;

  await http(`${BASE}/contacts/${contactId}/notes`, { method: 'POST', headers, body: JSON.stringify({ body: summary }) });

  let opportunityId;
  if (process.env.GHL_PIPELINE_ID && process.env.GHL_STAGE_ID) {
    const o = await http(`${BASE}/opportunities/`, {
      method: 'POST', headers,
      body: JSON.stringify({
        locationId, contactId, pipelineId: process.env.GHL_PIPELINE_ID, pipelineStageId: process.env.GHL_STAGE_ID,
        name: `Roof estimate – ${lead.address?.street || lead.lastName}`, status: 'open',
        monetaryValue: lead.quote?.mid || 0,
      }),
    });
    if (o.ok) opportunityId = o.body?.opportunity?.id;
    else console.error('[crm:gohighlevel] opportunity failed', o.status, o.body);
  }
  return { contactId, opportunityId };
}
module.exports = { send };
