// Config + lead storage (JSON files in /data). Leads are always saved locally first, so a CRM outage never loses one.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const CONFIG = path.join(DATA, 'config.json');
const DEFAULT = path.join(__dirname, '..', 'data', 'config.default.json');
const LEADS = path.join(DATA, 'leads.json');

fs.mkdirSync(DATA, { recursive: true });

function getConfig() {
  if (!fs.existsSync(CONFIG)) fs.copyFileSync(DEFAULT, CONFIG);
  return JSON.parse(fs.readFileSync(CONFIG, 'utf8'));
}
function saveConfig(cfg) {
  fs.writeFileSync(CONFIG + '.tmp', JSON.stringify(cfg, null, 2));
  fs.renameSync(CONFIG + '.tmp', CONFIG);
}
function resetConfig() { fs.copyFileSync(DEFAULT, CONFIG); return getConfig(); }

function readLeads() {
  if (!fs.existsSync(LEADS)) return [];
  return JSON.parse(fs.readFileSync(LEADS, 'utf8'));
}
function writeLeads(leads) {
  fs.writeFileSync(LEADS + '.tmp', JSON.stringify(leads, null, 2));
  fs.renameSync(LEADS + '.tmp', LEADS);
}
function addLead(lead) {
  const leads = readLeads();
  leads.unshift(lead);
  writeLeads(leads);
  return lead;
}
function updateLead(id, patch) {
  const leads = readLeads();
  const l = leads.find((x) => x.id === id);
  if (l) Object.assign(l, patch);
  writeLeads(leads);
  return l;
}

// Short-lived measurement sessions (address → measurement) for the widget flow
const sessions = new Map();
function newSession(data) {
  const id = crypto.randomBytes(12).toString('hex');
  sessions.set(id, { ...data, at: Date.now() });
  for (const [k, v] of sessions) if (Date.now() - v.at > 6 * 3600 * 1000) sessions.delete(k);
  return id;
}
const getSession = (id) => sessions.get(id);

module.exports = { getConfig, saveConfig, resetConfig, readLeads, addLead, updateLead, newSession, getSession, newId: () => crypto.randomUUID() };
