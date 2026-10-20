// GET /webhook/timesheet?t=TOKEN: the temp's mobile timesheet form.
const config = configFrom('Config');
const token = String($('Webhook').first().json.query?.t || '');
const ts = tableRows('Timesheets').find((t) => token && t.submit_token === token);
const temp = ts && tableRows('Temps').find((t) => t.temp_id === ts.temp_id);
const client = ts && tableRows('Clients').find((c) => c.client_id === ts.client_id);
const agency = config.agency_name;

if (!ts) {
  return [{ json: { html: page('Link not found', agency, `<h1>This link has expired</h1><p class="muted">Please contact ${esc(agency)} for a new timesheet link.</p>`) } }];
}
if (ts.status !== 'missing' && ts.status !== 'queried') {
  return [{ json: { html: page('Already submitted', agency, `<h1>Thanks, ${esc(temp.first_name)}</h1><div class="ok">Your hours for w/e ${esc(fmtDate(ts.week_ending))} are already in (${Number(ts.hours).toFixed(1)} hours).</div><p class="muted">Status: ${esc(ts.status)}. Questions? Reply to our text.</p>`) } }];
}

// Work in UTC calendar days so the form is right whatever the server's own timezone is.
const end = new Date(`${String(ts.week_ending).slice(0, 10)}T00:00:00Z`);
const days = [6, 5, 4, 3, 2, 1, 0].map((back) => {
  const d = new Date(end.getTime() - back * 86400000);
  return { key: d.toISOString().slice(0, 10), label: d.toLocaleDateString('en-GB', { timeZone: 'UTC', weekday: 'short' }), date: d.getUTCDate() };
});
const defaults = { Mon: 8, Tue: 8, Wed: 8, Thu: 8, Fri: 8, Sat: 0, Sun: 0 };
const inputs = days.map((d) => `<div><label for="h_${d.key}">${d.label} ${d.date}</label><input id="h_${d.key}" name="h_${d.key}" type="number" min="0" max="16" step="0.25" value="${defaults[d.label] ?? 0}"></div>`).join('');

const body = `<h1>Timesheet: w/e ${esc(fmtDate(ts.week_ending))}</h1>
<p>Hi ${esc(temp.first_name)}, enter the hours you worked at <strong>${esc(client.name)}</strong> (${esc(client.site)}).${ts.status === 'queried' ? ' <br><span class="warn">Your client queried the last submission. Please check and resubmit.</span>' : ''}</p>
<form method="post" action="${config.base_url}/webhook/timesheet">
<input type="hidden" name="t" value="${esc(token)}">
<div class="days">${inputs}</div>
<label for="notes">Notes for the agency (optional)</label><input id="notes" name="notes" type="text" maxlength="200" placeholder="e.g. stayed late Thursday for a delivery">
<label><input type="checkbox" name="confirm" value="yes" required style="width:auto;margin-right:6px">I confirm these hours are correct</label>
<button class="btn" type="submit">Submit hours</button>
</form><p class="muted">Your manager ${esc(client.manager_name)} will approve them. You'll get a text when they do.</p>`;
return [{ json: { html: page('Submit your timesheet', agency, body) } }];
