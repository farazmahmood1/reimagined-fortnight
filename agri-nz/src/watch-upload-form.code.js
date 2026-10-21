// GET /webhook/register/upload?t=TOKEN: the person responsible uploads a renewed certificate or consent from their phone.
const cfg = configFrom();
const token = String($('Webhook').first().json.query?.t || '');
const r = tableRows('Register').find((x) => token && x.upload_token === token);
if (!r) return [{ json: { html: page('Link not found', `<h1>This upload link has expired</h1><p class="muted">Please contact ${esc(cfg.admin_name)} at ${esc(cfg.business_name)}.</p>`) } }];
if (r.status === 'received') {
  return [{ json: { html: page('Received', `<h1>Thanks, ${esc(firstName(r.responsible_name))}</h1>${callout('ok', `We have your ${esc(r.type.toLowerCase())}. ${esc(cfg.admin_name)} is checking it.`)}`) } }];
}
const st = registerState(r, cfg, nzToday());
const body = `<h1>${esc(r.type)}</h1>
<p>Kia ora ${esc(firstName(r.responsible_name))}. ${esc(selfText(r, st))} Upload the ${r.kind === 'Consent' ? 'renewed consent' : 'new certificate'} here. It goes to ${esc(cfg.admin_name)} to check.</p>
${r.note ? callout('warn', `<b>Please upload it again.</b> ${esc(r.note)}`) : ''}
<form method="post" action="${cfg.base_url}/webhook/register/upload" enctype="multipart/form-data">
<input type="hidden" name="t" value="${esc(token)}">
<label for="file">Document (PDF or photo, up to 10 MB)</label><input id="file" name="file" type="file" accept="image/*,application/pdf" required>
<label for="expiry">New expiry date</label><input id="expiry" name="expiry" type="date" required>
<button class="btn" type="submit">Upload securely</button></form>
<p class="muted">Only ${esc(cfg.business_name)} can see your document. There is no login.</p>`;
return [{ json: { html: page(`Upload: ${r.type}`, body) } }];
