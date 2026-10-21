// POST /webhook/farmplan/upload (multipart): store the file and mark the evidence "received". A person still has to verify it.
// Returns { updates, messages, audit, html, savePath } and passes the uploaded file on as binary "data".
const cfg = configFrom();
const hook = $('Webhook').first();
const form = hook.json.body || {};
const token = String(form.t || '');
const it = tableRows('Evidence').find((e) => token && e.upload_token === token);
const bin = hook.binary || {};
const fileKey = Object.keys(bin)[0];
const file = fileKey ? bin[fileKey] : null;
const none = { updates: [], messages: [], audit: [], savePath: '' };
const fail = (title, text) => [{ json: { ...none, html: page(title, `<h1>${esc(title)}</h1>${callout('warn', esc(text))}`) } }];

if (!it) return fail('Upload link not valid', `Please contact ${cfg.admin_name} for a new link.`);
if (!file) return fail('No file received', 'Please choose a file and try again.');
const allowed = ['application/pdf', 'image/jpeg', 'image/png', 'image/heic', 'image/webp', 'text/csv', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
if (!allowed.includes(file.mimeType)) return fail('File type not accepted', 'Please upload a PDF, a photo (JPG or PNG), a spreadsheet or a Word file.');

const farm = tableRows('Farms').find((f) => f.farm_id === it.farm_id);
const ext = (file.fileName || '').split('.').pop().toLowerCase().replace(/[^a-z0-9]/g, '') || (file.mimeType === 'application/pdf' ? 'pdf' : 'jpg');
const storedName = `${it.item_id}-${it.requirement.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40)}-${Date.now()}.${ext}`;
const original = String(file.fileName || '').slice(0, 120);
const note = String(form.note || '').trim().slice(0, 200);
const updates = [{ id: it.id, status: 'received', file_name: storedName, original_name: original, received_at: nowIso(), note, verified_at: '', verified_by: '' }];
const messages = [msg({
  channel: 'Email', to_name: farm.manager_name, to_address: farm.manager_email, link: `${cfg.base_url}/webhook/console?tab=gate`, related: it.item_id, workflow: 'Evidence uploaded',
  subject: `Please check: ${it.provider_name} uploaded ${it.requirement}`,
  body: `${it.provider_name} uploaded "${it.requirement}" for ${farm.name}${note ? ` (note: ${note})` : ''}. Open it, check it is the right document, then mark it verified or send it back with a reason.`,
})];
const audit = [auditRow(it.provider_name, 'person', 'Farm plan', farm.name, `Uploaded: ${it.requirement}`, `${original}. Waiting for ${farm.manager_name} to check it.`)];
const html = page('Uploaded', `<h1>Thanks, ${esc(firstName(it.provider_name))}</h1>${callout('ok', `<b>Your file is uploaded securely.</b> ${esc(farm.manager_name)} will check it. We'll message you only if something is wrong.`)}`);
return [{ json: { updates, messages, audit, html, savePath: `evidence/${storedName}` }, binary: { data: file } }];
