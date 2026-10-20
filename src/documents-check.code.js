// Daily document check: request missing documents, warn before expiry, block expired ones,
// and ask the consultant to verify uploads. Never messages the same person about the same
// document twice in 24 hours. Returns { docUpdates, tempUpdates, messages, summary }.
const config = configFrom('Config');
const base = config.base_url;
const temps = tableRows('Temps');
const T = Object.fromEntries(temps.map((t) => [t.temp_id, t]));
const C = Object.fromEntries(tableRows('Clients').map((c) => [c.client_id, c]));
const docs = tableRows('Documents');
const today = new Date(new Date().toISOString().slice(0, 10));
const daysTo = (d) => Math.round((new Date(d) - today) / 86400000);
const recentlyReminded = (d) => d.last_reminder_at && Date.now() - new Date(d.last_reminder_at).getTime() < 24 * 3600 * 1000;
const longDate = (d) => new Date(d).toLocaleDateString('en-GB', { timeZone: 'UTC', day: 'numeric', month: 'long', year: 'numeric' });

const stateOf = (d) => {
  if (d.status === 'missing') return 'missing';
  if (d.expiry_date) {
    const n = daysTo(d.expiry_date);
    if (n < 0) return 'expired';
    if (n <= 30 && d.status === 'verified') return 'expiring';
  }
  return d.status; // received | verified
};

const docUpdates = [];
const messages = [];
const blocked = [];
const actions = [];
const toVerify = [];
let skipped = 0;

for (const d of docs) {
  const state = stateOf(d);
  const temp = T[d.temp_id];
  if (!temp) continue;
  const link = `${base}/webhook/documents/upload?t=${d.upload_token}`;
  if (state === 'received') { toVerify.push(`${fullName(temp)}: ${d.doc_type}`); continue; }
  if (state === 'verified') continue;
  if (state === 'expired') blocked.push(`${fullName(temp)}: ${d.doc_type} expired ${longDate(d.expiry_date)}`);
  if (state === 'missing' && d.doc_type === 'Right to work') blocked.push(`${fullName(temp)}: right to work not on file`);
  if (state === 'missing' || state === 'expiring') actions.push(`${fullName(temp)}: ${d.doc_type} ${state === 'missing' ? 'missing' : 'expires ' + longDate(d.expiry_date)}`);
  if (recentlyReminded(d)) { skipped++; continue; }
  const body = {
    missing: `Hi ${temp.first_name}, it's ${config.agency_name}. We still need your ${d.doc_type} before your next shift at ${C[temp.client_id].name}. Upload a photo or PDF here:`,
    expiring: `Hi ${temp.first_name}, your ${d.doc_type} on file expires on ${longDate(d.expiry_date)} (${daysTo(d.expiry_date)} days). Please upload the renewal here so your shifts aren't affected:`,
    expired: `Hi ${temp.first_name}, your ${d.doc_type} expired on ${longDate(d.expiry_date)}, so we can't book you for ${C[temp.client_id].name} until we have the renewal. Upload it here:`,
  }[state];
  messages.push({ channel: 'SMS', to_name: fullName(temp), to_address: temp.phone, subject: '', body, link, related: `${d.doc_id} ${d.doc_type}`, workflow: 'Document check' });
  docUpdates.push({ id: d.id, last_reminder_at: nowIso(), reminders_sent: Number(d.reminders_sent || 0) + 1 });
}

// Compliance status per temp, written back so the booking team sees it.
const tempUpdates = temps.map((t) => {
  const states = docs.filter((d) => d.temp_id === t.temp_id).map(stateOf);
  const rtwMissing = docs.some((d) => d.temp_id === t.temp_id && d.doc_type === 'Right to work' && d.status === 'missing');
  const status = states.includes('expired') || rtwMissing ? 'Blocked' : states.some((s) => s !== 'verified') ? 'Action needed' : 'Compliant';
  return { id: t.id, compliance_status: status, compliance_checked_at: nowIso() };
});

if (blocked.length || actions.length || toVerify.length) {
  messages.push({
    channel: 'Email', to_name: config.consultant_name, to_address: config.consultant_email,
    subject: `Compliance check: ${blocked.length} do-not-book, ${actions.length} action needed, ${toVerify.length} to verify`,
    body: [
      blocked.length ? `DO NOT BOOK: ${blocked.join('; ')}.` : '',
      actions.length ? `Chasing: ${actions.join('; ')}.` : '',
      toVerify.length ? `Uploaded, please verify: ${toVerify.join('; ')}.` : '',
    ].filter(Boolean).join(' '),
    link: `${base}/webhook/console`, related: 'Daily document check', workflow: 'Document check',
  });
}

return [{ json: { docUpdates, tempUpdates, messages, summary: `Document check done: ${blocked.length} blocked, ${actions.length} chased${skipped ? ` (${skipped} already reminded today)` : ''}, ${toVerify.length} waiting for verification.` } }];
