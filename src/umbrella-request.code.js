// Monthly umbrella evidence request (joint and several liability since 6 April 2026).
// For each umbrella company paying our temps: open an evidence record for the period and send a
// secure upload link; if one is already open and not received, send a reminder.
// Returns { inserts, updates, messages, summary }.
const config = configFrom('Config');
const period = config.evidence_period;
const base = config.base_url;
const temps = tableRows('Temps');
const evidence = tableRows('Evidence');
const periodLabel = new Date(`${period}-01`).toLocaleDateString('en-GB', { timeZone: 'UTC', month: 'long', year: 'numeric' });

const inserts = [];
const updates = [];
const messages = [];
for (const u of tableRows('Umbrellas')) {
  const workers = temps.filter((t) => t.pay_route === u.umbrella_id);
  if (!workers.length) continue;
  const existing = evidence.find((e) => e.umbrella_id === u.umbrella_id && e.period === period);
  if (existing && existing.status !== 'requested') continue;
  const token = existing ? existing.upload_token : newToken();
  const evidenceId = existing ? existing.evidence_id : `EV-${period}-${u.umbrella_id}`;
  const reminders = existing ? Number(existing.reminders_sent || 0) + 1 : 0;
  if (existing) updates.push({ id: existing.id, reminders_sent: reminders, last_reminder_at: nowIso() });
  else inserts.push({ evidence_id: evidenceId, umbrella_id: u.umbrella_id, period, status: 'requested', upload_token: token, requested_at: nowIso(), reminders_sent: 0 });
  messages.push({
    channel: 'Email', to_name: `${u.name} (${u.contact_name})`, to_address: u.contact_email,
    subject: `${existing ? 'Reminder: ' : ''}${config.agency_name}: payslip evidence for ${periodLabel} (${workers.length} worker${workers.length > 1 ? 's' : ''})`,
    body: `Please upload the ${periodLabel} payslip summary for ${workers.map(fullName).join(', ')}: one row per worker with hours, assignment income, gross taxable pay, non-taxable payments and net pay. CSV template on the upload page.`,
    link: `${base}/webhook/umbrella/evidence?t=${token}`, related: evidenceId, workflow: 'Umbrella evidence request',
  });
}
return [{ json: { inserts, updates, messages, summary: messages.length ? `Requested ${periodLabel} evidence from ${messages.length} umbrella compan${messages.length > 1 ? 'ies' : 'y'}.` : 'All umbrella evidence for this period is already in.' } }];
