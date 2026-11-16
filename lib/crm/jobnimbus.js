// JobNimbus – creates a contact with the estimate in the description.
// Env: JOBNIMBUS_API_KEY, optional JOBNIMBUS_RECORD_TYPE (default "Customer"), JOBNIMBUS_STATUS (default "Lead"), JOBNIMBUS_SOURCE
// Record type / status names must match the workflow names in your JobNimbus account exactly.
async function send(lead, summary) {
  const { http } = require('./index');
  const key = process.env.JOBNIMBUS_API_KEY;
  if (!key) throw new Error('JOBNIMBUS_API_KEY not set');
  const r = await http('https://app.jobnimbus.com/api1/contacts', {
    method: 'POST',
    headers: { Authorization: `bearer ${key}` },
    body: JSON.stringify({
      first_name: lead.firstName, last_name: lead.lastName,
      display_name: `${lead.firstName} ${lead.lastName}`.trim(),
      email: lead.email, mobile_phone: lead.phone,
      address_line1: lead.address?.street, city: lead.address?.city, state_text: lead.address?.state, zip: lead.address?.zip,
      record_type_name: process.env.JOBNIMBUS_RECORD_TYPE || 'Customer',
      status_name: process.env.JOBNIMBUS_STATUS || 'Lead',
      source_name: process.env.JOBNIMBUS_SOURCE || 'Website',
      description: summary,
    }),
  });
  if (!r.ok) throw new Error(`JobNimbus ${r.status}: ${JSON.stringify(r.body).slice(0, 200)}`);
  return { contactId: r.body?.jnid };
}
module.exports = { send };
