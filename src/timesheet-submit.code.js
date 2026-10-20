// POST /webhook/timesheet: save the temp's hours and send the client manager a one-click approval link.
const config = configFrom('Config');
const form = $('Webhook').first().json.body || {};
const token = String(form.t || '');
const ts = tableRows('Timesheets').find((t) => token && t.submit_token === token);
const agency = config.agency_name;
const empty = { updates: [], messages: [] };

if (!ts || (ts.status !== 'missing' && ts.status !== 'queried')) {
  return [{ json: { ...empty, html: page('Link not valid', agency, `<h1>We couldn't save this timesheet</h1><p class="muted">The link has already been used or has expired. Please contact ${esc(agency)}.</p>`) } }];
}
const temp = tableRows('Temps').find((t) => t.temp_id === ts.temp_id);
const client = tableRows('Clients').find((c) => c.client_id === ts.client_id);
const dayKeys = Object.keys(form).filter((k) => k.startsWith('h_')).sort();
const daily = dayKeys.map((k) => ({ day: k.slice(2), hours: Math.max(0, Math.min(16, Number(form[k]) || 0)) }));
const hours = round2(daily.reduce((s, d) => s + d.hours, 0));

if (hours <= 0 || hours > 72) {
  return [{ json: { ...empty, html: page('Check your hours', agency, `<h1>Please check your hours</h1><div class="warn">A week must be between 0.25 and 72 hours. You entered ${hours}.</div><a class="btn" href="${config.base_url}/webhook/timesheet?t=${esc(token)}">Go back</a>`) } }];
}

const approveToken = newToken();
const breakdown = daily.filter((d) => d.hours > 0).map((d) => `${new Date(d.day).toLocaleDateString('en-GB', { timeZone: 'UTC', weekday: 'short' })} ${d.hours}`).join(', ');
const updates = [{ id: ts.id, status: 'submitted', hours, daily_breakdown: breakdown, notes: String(form.notes || '').slice(0, 200), submitted_at: nowIso(), approve_token: approveToken }];
const weekLabel = new Date(ts.week_ending).toLocaleDateString('en-GB', { timeZone: 'UTC', day: 'numeric', month: 'short' });
const messages = [{
  channel: 'Email', to_name: client.manager_name, to_address: client.manager_email,
  subject: `Approve ${fullName(temp)}'s hours: ${hours} hrs, w/e ${weekLabel}`,
  body: `${fullName(temp)} (${temp.role}) submitted ${hours} hours: ${breakdown}.${form.notes ? ' Note: ' + String(form.notes).slice(0, 200) : ''} Approve or query with one click.`,
  link: `${config.base_url}/webhook/timesheet/approve?t=${approveToken}`, related: ts.timesheet_id, workflow: 'Timesheet submitted',
}];
const html = page('Hours submitted', agency, `<h1>Thanks, ${esc(temp.first_name)}</h1><div class="ok">${hours} hours sent to ${esc(client.manager_name)} for approval.</div>
<table>${daily.map((d) => `<tr><td>${new Date(d.day).toLocaleDateString('en-GB', { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'short' })}</td><td class="num">${d.hours}</td></tr>`).join('')}<tr><th>Total</th><th class="num">${hours}</th></tr></table>
<p class="muted">We'll text you once they're approved.</p>`);
return [{ json: { updates, messages, html } }];
