// POST /webhook/register/upload (multipart): store the document and the new expiry date, and ask the admin to verify.
// The register keeps the old expiry date until a person verifies the upload.
// Returns { updates, messages, audit, html, savePath } and passes the uploaded file on as binary "data".
const cfg = configFrom();
const hook = $('Webhook').first();
const form = hook.json.body || {};
const token = String(form.t || '');
const r = tableRows('Register').find((x) => token && x.upload_token === token);
const bin = hook.binary || {};
const fileKey = Object.keys(bin)[0];
const file = fileKey ? bin[fileKey] : null;
const none = { updates: [], messages: [], audit: [], savePath: '' };
const fail = (title, text) => [{ json: { ...none, html: page(title, `<h1>${esc(title)}</h1>${callout('warn', esc(text))}`) } }];

if (!r) return fail('Upload link not valid', `Please contact ${cfg.admin_name} for a new link.`);
if (!file) return fail('No file received', 'Please choose a file and try again.');
if (!['application/pdf', 'image/jpeg', 'image/png', 'image/heic', 'image/webp'].includes(file.mimeType)) return fail('File type not accepted', 'Please upload a photo (JPG or PNG) or a PDF.');
const expiry = String(form.expiry || '');
if (!/^\d{4}-\d{2}-\d{2}$/.test(expiry)) return fail('Expiry date needed', 'Please enter the new expiry date shown on the document.');
if (expiry <= nzToday()) return fail('That date has passed', 'The new expiry date must be in the future. Check the date on the document.');

const ext = (file.fileName || '').split('.').pop().toLowerCase().replace(/[^a-z0-9]/g, '') || (file.mimeType === 'application/pdf' ? 'pdf' : 'jpg');
const storedName = `${r.reg_id}-${r.type.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40)}-${Date.now()}.${ext}`;
const original = String(file.fileName || '').slice(0, 120);
const admin = person(cfg, 'admin');
return [{ json: {
  updates: [{ id: r.id, status: 'received', new_expiry: expiry, file_name: storedName, original_name: original, received_at: nowIso(), note: '' }],
  messages: [msg({ channel: 'Email', to_name: admin.name, to_address: admin.email, link: `${cfg.base_url}/webhook/console?tab=gate`, related: r.reg_id, workflow: 'Certificate uploaded',
    subject: `Please verify: ${r.responsible_name} uploaded ${r.type}`,
    body: `${r.responsible_name} uploaded their ${r.type.toLowerCase()} with a new expiry date of ${fmtDate(expiry)}. Check it against the document, then mark it verified or send it back. The register keeps the old date until you do.` })],
  audit: [auditRow(r.responsible_name, 'person', 'Consents', `${r.type}, ${r.responsible_name}`, 'Uploaded a renewal', `${original}, new expiry ${fmtDate(expiry)}. Waiting for ${admin.name} to verify.`)],
  html: page('Uploaded', `<h1>Thanks, ${esc(firstName(r.responsible_name))}</h1>${callout('ok', `<b>Your ${esc(r.type.toLowerCase())} is uploaded securely.</b> ${esc(admin.name)} will check it. We'll message you only if something is wrong.`)}`),
  savePath: `register/${storedName}`,
}, binary: { data: file } }];
