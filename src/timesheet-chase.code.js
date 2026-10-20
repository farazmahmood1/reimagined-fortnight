// Monday chase: text every temp whose timesheet is missing, nudge clients who haven't approved,
// and send the consultant one summary. Returns { updates, messages, summary }.
const config = configFrom('Config');
const T = Object.fromEntries(tableRows('Temps').map((t) => [t.temp_id, t]));
const C = Object.fromEntries(tableRows('Clients').map((c) => [c.client_id, c]));
const week = config.week_ending;
const base = config.base_url;
const sheets = tableRows('Timesheets').filter((t) => t.week_ending === week);
const missing = sheets.filter((t) => t.status === 'missing' || t.status === 'queried');
const awaiting = sheets.filter((t) => t.status === 'submitted');
const weekLabel = new Date(week).toLocaleDateString('en-GB', { timeZone: 'UTC', day: 'numeric', month: 'short' });

const updates = [];
const messages = [];

for (const ts of missing) {
  const temp = T[ts.temp_id];
  const client = C[ts.client_id];
  const reminders = Number(ts.reminders_sent || 0) + 1;
  const link = `${base}/webhook/timesheet?t=${ts.submit_token}`;
  const body = reminders === 1
    ? `Hi ${temp.first_name}, it's ${config.agency_name}. Please submit your hours for w/e ${weekLabel} at ${client.name}. It takes under a minute:`
    : `Hi ${temp.first_name}, your timesheet for w/e ${weekLabel} at ${client.name} is still missing. Payroll closes Friday 12pm, so please submit today:`;
  messages.push({ channel: 'SMS', to_name: fullName(temp), to_address: temp.phone, subject: '', body, link, related: ts.timesheet_id, workflow: 'Timesheet chase' });
  updates.push({ id: ts.id, reminders_sent: reminders, last_reminder_at: nowIso() });
}

for (const ts of awaiting) {
  const temp = T[ts.temp_id];
  const client = C[ts.client_id];
  messages.push({
    channel: 'Email', to_name: client.manager_name, to_address: client.manager_email,
    subject: `Reminder: please approve ${fullName(temp)}'s hours (w/e ${weekLabel})`,
    body: `${fullName(temp)} submitted ${Number(ts.hours).toFixed(1)} hours. One click approves them for payroll.`,
    link: `${base}/webhook/timesheet/approve?t=${ts.approve_token}`, related: ts.timesheet_id, workflow: 'Timesheet chase',
  });
}

const done = sheets.filter((t) => t.status === 'approved' || t.status === 'exported').length;
messages.push({
  channel: 'Email', to_name: config.consultant_name, to_address: config.consultant_email,
  subject: `Timesheets w/e ${weekLabel}: ${done} of ${sheets.length} approved`,
  body: `Chased ${missing.length} temps by SMS (${missing.map((t) => fullName(T[t.temp_id])).join(', ') || 'none'}). Reminded ${awaiting.length} client manager(s) to approve. Anything still missing at 2pm needs a call.`,
  link: `${base}/webhook/console`, related: `Week ending ${week}`, workflow: 'Timesheet chase',
});

return [{ json: { updates, messages, summary: `Chased ${missing.length} missing timesheets and ${awaiting.length} client approvals.` } }];
