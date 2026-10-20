// GET /webhook/umbrella/evidence?t=TOKEN: upload page for the umbrella company.
const config = configFrom('Config');
const token = String($('Webhook').first().json.query?.t || '');
const ev = tableRows('Evidence').find((e) => token && e.upload_token === token);
const agency = config.agency_name;
if (!ev) {
  return [{ json: { html: page('Link not found', agency, `<h1>This evidence link is not valid</h1><p class="muted">Please contact ${esc(config.compliance_email)}.</p>`) } }];
}
const umbrella = tableRows('Umbrellas').find((u) => u.umbrella_id === ev.umbrella_id);
const workers = tableRows('Temps').filter((t) => t.pay_route === ev.umbrella_id);
if (ev.status !== 'requested') {
  return [{ json: { html: page('Received', agency, `<h1>Thank you</h1><div class="ok">We received ${esc(ev.period)} evidence from ${esc(umbrella.name)}.</div>`) } }];
}
const template = 'temp_id,worker_name,period,hours,assignment_income,gross_taxable_pay,non_taxable_payments,net_pay';
const body = `<h1>Payslip evidence: ${esc(ev.period)}</h1>
<p>${esc(umbrella.name)}, please upload a CSV with one row per worker. ${esc(agency)} checks it against approved hours and the assignment rates we paid you.</p>
<table><tr><th>Worker ID</th><th>Worker</th></tr>${workers.map((w) => `<tr><td>${esc(w.temp_id)}</td><td>${esc(fullName(w))}</td></tr>`).join('')}</table>
<label>CSV columns</label><p class="muted" style="font-family:Consolas,monospace;font-size:12px">${template}</p>
<form method="post" action="${config.base_url}/webhook/umbrella/evidence" enctype="multipart/form-data">
<input type="hidden" name="t" value="${esc(token)}">
<label for="file">Payslip summary (CSV)</label><input id="file" name="file" type="file" accept=".csv,text/csv" required>
<button class="btn" type="submit">Upload evidence</button></form>`;
return [{ json: { html: page('Umbrella evidence', agency, body) } }];
