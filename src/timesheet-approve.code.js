// GET /webhook/timesheet/approve?t=TOKEN[&a=approve|query]: the client manager's one-click approval.
const config = configFrom('Config');
const q = $('Webhook').first().json.query || {};
const token = String(q.t || '');
const action = String(q.a || '');
const ts = tableRows('Timesheets').find((t) => token && t.approve_token === token);
const agency = config.agency_name;
const empty = { updates: [], messages: [] };

if (!ts) {
  return [{ json: { ...empty, html: page('Link not found', agency, `<h1>This approval link is no longer valid</h1><p class="muted">Please contact ${esc(agency)}.</p>`) } }];
}
const temp = tableRows('Temps').find((t) => t.temp_id === ts.temp_id);
const client = tableRows('Clients').find((c) => c.client_id === ts.client_id);
const pay = round2(Number(ts.hours) * Number(temp.charge_rate));
const summary = `<table><tr><td>Worker</td><td>${esc(fullName(temp))}, ${esc(temp.role)}</td></tr><tr><td>Week ending</td><td>${esc(fmtDate(ts.week_ending))}</td></tr>
<tr><td>Hours</td><td>${Number(ts.hours).toFixed(2)} (${esc(ts.daily_breakdown || '')})</td></tr><tr><td>Charge</td><td>${money(pay)} + VAT at ${money(temp.charge_rate)}/hr</td></tr>${ts.notes ? `<tr><td>Note</td><td>${esc(ts.notes)}</td></tr>` : ''}</table>`;

if (ts.status !== 'submitted') {
  return [{ json: { ...empty, html: page('Already done', agency, `<h1>Already ${esc(ts.status)}</h1>${summary}<p class="muted">No further action needed.</p>`) } }];
}
if (action !== 'approve' && action !== 'query') {
  const link = (a) => `${config.base_url}/webhook/timesheet/approve?t=${esc(token)}&a=${a}`;
  return [{ json: { ...empty, html: page('Approve hours', agency, `<h1>Approve hours, ${esc(client.manager_name)}?</h1>${summary}
  <a class="btn" href="${link('approve')}">Approve</a><a class="btn alt" href="${link('query')}">Query</a>`) } }];
}

const weekLabel = new Date(ts.week_ending).toLocaleDateString('en-GB', { timeZone: 'UTC', day: 'numeric', month: 'short' });
if (action === 'approve') {
  return [{ json: {
    updates: [{ id: ts.id, status: 'approved', approved_at: nowIso(), approved_by: client.manager_name }],
    messages: [{ channel: 'SMS', to_name: fullName(temp), to_address: temp.phone, subject: '', body: `Good news ${temp.first_name}: ${client.manager_name} approved your ${ts.hours} hours for w/e ${weekLabel}. They'll be paid on Friday.`, link: '', related: ts.timesheet_id, workflow: 'Timesheet approved' }],
    html: page('Approved', agency, `<h1>Approved. Thank you, ${esc(client.manager_name.split(' ')[0])}.</h1><div class="ok">${Number(ts.hours).toFixed(2)} hours for ${esc(fullName(temp))} are approved for payroll.</div>${summary}`),
  } }];
}
return [{ json: {
  updates: [{ id: ts.id, status: 'queried', queried_at: nowIso() }],
  messages: [{ channel: 'Email', to_name: config.consultant_name, to_address: config.consultant_email, subject: `Query: ${client.name} queried ${fullName(temp)}'s hours (w/e ${weekLabel})`, body: `${client.manager_name} queried ${ts.hours} hours. Call the client, then the temp can resubmit from the same link.`, link: `${config.base_url}/webhook/console`, related: ts.timesheet_id, workflow: 'Timesheet queried' }],
  html: page('Queried', agency, `<h1>Thanks, we'll look into it</h1><div class="warn">${esc(config.consultant_name)} from ${esc(agency)} will call you about these hours today.</div>${summary}`),
} }];
