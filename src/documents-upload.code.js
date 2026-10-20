// POST /webhook/documents/upload (multipart): store the file and mark the document "received".
// Returns { updates, messages, html, savePath } and passes the uploaded file on as binary "data".
const config = configFrom('Config');
const hook = $('Webhook').first();
const form = hook.json.body || {};
const token = String(form.t || '');
const doc = tableRows('Documents').find((d) => token && d.upload_token === token);
const agency = config.agency_name;
const bin = hook.binary || {};
const fileKey = Object.keys(bin)[0];
const file = fileKey ? bin[fileKey] : null;
const fail = (title, msg) => [{ json: { updates: [], messages: [], savePath: '', html: page(title, agency, `<h1>${esc(title)}</h1><div class="warn">${esc(msg)}</div>`) } }];

if (!doc) return fail('Upload link not valid', `Please contact ${agency} for a new link.`);
if (!file) return fail('No file received', 'Please choose a photo or PDF and try again.');
const allowed = ['application/pdf', 'image/jpeg', 'image/png', 'image/heic', 'image/webp'];
if (!allowed.includes(file.mimeType)) return fail('File type not accepted', 'Please upload a photo (JPG or PNG) or a PDF.');

const temp = tableRows('Temps').find((t) => t.temp_id === doc.temp_id);
const ext = (file.fileName || '').split('.').pop().toLowerCase().replace(/[^a-z0-9]/g, '') || (file.mimeType === 'application/pdf' ? 'pdf' : 'jpg');
const storedName = `${doc.doc_id}-${doc.doc_type.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now()}.${ext}`;
const expiry = /^\d{4}-\d{2}-\d{2}$/.test(String(form.expiry || '')) ? form.expiry : doc.expiry_date || '';
const updates = [{ id: doc.id, status: 'received', file_name: storedName, original_name: String(file.fileName || '').slice(0, 120), expiry_date: expiry, received_at: nowIso() }];
const messages = [{
  channel: 'Email', to_name: config.consultant_name, to_address: config.consultant_email,
  subject: `Please verify: ${fullName(temp)} uploaded ${doc.doc_type}`,
  body: `${fullName(temp)} uploaded their ${doc.doc_type}${expiry ? ' (expires ' + expiry + ')' : ''}. Check it against the original and mark it verified.`,
  link: `${config.base_url}/webhook/console`, related: doc.doc_id, workflow: 'Document upload',
}];
const html = page('Uploaded', agency, `<h1>Thanks, ${esc(temp.first_name)}</h1><div class="ok">Your ${esc(doc.doc_type)} has been uploaded securely.</div><p class="muted">Our compliance team will check it. We'll text you if we need anything else.</p>`);
return [{ json: { updates, messages, html, savePath: `documents/${storedName}` }, binary: { data: file } }];
