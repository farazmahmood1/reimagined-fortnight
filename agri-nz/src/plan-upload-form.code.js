// GET /webhook/farmplan/upload?t=TOKEN: the provider uploads one piece of evidence from their phone.
const cfg = configFrom();
const token = String($('Webhook').first().json.query?.t || '');
const it = tableRows('Evidence').find((e) => token && e.upload_token === token);
if (!it) return [{ json: { html: page('Link not found', `<h1>This upload link has expired</h1><p class="muted">Please contact ${esc(cfg.admin_name)} at ${esc(cfg.business_name)}.</p>`) } }];
const farm = tableRows('Farms').find((f) => f.farm_id === it.farm_id) || {};
if (it.status === 'received' || it.status === 'verified') {
  return [{ json: { html: page('Received', `<h1>Thanks, ${esc(firstName(it.provider_name))}</h1>${callout('ok', `We have the ${esc(it.requirement.toLowerCase())} for ${esc(farm.name)}. ${it.status === 'verified' ? 'It has been checked.' : `${esc(farm.manager_name)} is checking it.`}`)}`) } }];
}
const body = `<h1>${esc(it.requirement)}</h1>
<p>Kia ora ${esc(firstName(it.provider_name))}. ${esc(cfg.business_name)} needs this for the <b>${esc(farm.name)}</b> farm plan, due ${esc(fmtDate(cfg.plan_deadline))}. Upload a PDF or a clear photo. It goes straight to ${esc(farm.manager_name)}.</p>
${it.note ? callout('warn', `<b>Please upload it again.</b> ${esc(it.note)}`) : ''}
<form method="post" action="${cfg.base_url}/webhook/farmplan/upload" enctype="multipart/form-data">
<input type="hidden" name="t" value="${esc(token)}">
<label for="file">File (PDF, photo, spreadsheet or Word, up to 10 MB)</label>
<input id="file" name="file" type="file" accept="image/*,application/pdf,.csv,.xlsx,.docx" required>
<label for="note">Anything we should know? (optional)</label><input id="note" name="note" maxlength="200">
<button class="btn" type="submit">Upload securely</button></form>
<p class="muted">Only ${esc(cfg.business_name)} can see your file. There is no login.</p>`;
return [{ json: { html: page(`Upload: ${it.requirement}`, body) } }];
