// HubSpot – creates (or finds) the contact and attaches the estimate as a note.
// Env: HUBSPOT_TOKEN (Private App token with crm.objects.contacts.write scope)
const BASE = 'https://api.hubapi.com';

async function send(lead, summary) {
  const { http } = require('./index');
  const token = process.env.HUBSPOT_TOKEN;
  if (!token) throw new Error('HUBSPOT_TOKEN not set');
  const headers = { Authorization: `Bearer ${token}` };

  const c = await http(`${BASE}/crm/v3/objects/contacts`, {
    method: 'POST', headers,
    body: JSON.stringify({ properties: {
      email: lead.email, firstname: lead.firstName, lastname: lead.lastName, phone: lead.phone,
      address: lead.address?.street, city: lead.address?.city, state: lead.address?.state, zip: lead.address?.zip,
    } }),
  });
  let contactId = c.body?.id;
  if (c.status === 409) {
    // Contact already exists – HubSpot returns "Existing ID: 123" in the message
    contactId = (String(c.body?.message || '').match(/Existing ID:\s*(\d+)/) || [])[1];
  } else if (!c.ok) {
    throw new Error(`HubSpot contact ${c.status}: ${JSON.stringify(c.body).slice(0, 200)}`);
  }
  if (!contactId) throw new Error('HubSpot: could not determine contact id');

  const n = await http(`${BASE}/crm/v3/objects/notes`, {
    method: 'POST', headers,
    body: JSON.stringify({
      properties: { hs_timestamp: new Date().toISOString(), hs_note_body: summary.replace(/\n/g, '<br>') },
      associations: [{ to: { id: contactId }, types: [{ associationCategory: 'HUBSPOT_DEFINED', associationTypeId: 202 }] }],
    }),
  });
  if (!n.ok) console.error('[crm:hubspot] note failed', n.status, n.body);
  return { contactId };
}
module.exports = { send };
