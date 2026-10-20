// GET /webhook/documents/upload?t=TOKEN: the temp uploads a document from their phone.
const config = configFrom('Config');
const token = String($('Webhook').first().json.query?.t || '');
const doc = tableRows('Documents').find((d) => token && d.upload_token === token);
const agency = config.agency_name;
if (!doc) {
  return [{ json: { html: page('Link not found', agency, `<h1>This upload link has expired</h1><p class="muted">Please contact ${esc(agency)}.</p>`) } }];
}
const temp = tableRows('Temps').find((t) => t.temp_id === doc.temp_id);
if (doc.status === 'received') {
  return [{ json: { html: page('Received', agency, `<h1>Thanks, ${esc(temp.first_name)}</h1><div class="ok">We have your ${esc(doc.doc_type)}. Our team is checking it.</div>`) } }];
}
const needsExpiry = doc.doc_type !== 'Right to work' || doc.expiry_date;
const body = `<h1>Upload your ${esc(doc.doc_type)}</h1>
<p>Hi ${esc(temp.first_name)}, take a clear photo or upload a PDF. It goes straight to ${esc(agency)}'s compliance team.</p>
<form method="post" action="${config.base_url}/webhook/documents/upload" enctype="multipart/form-data">
<input type="hidden" name="t" value="${esc(token)}">
<label for="file">Document (photo or PDF, max 10 MB)</label><input id="file" name="file" type="file" accept="image/*,application/pdf" required>
${needsExpiry ? '<label for="expiry">Expiry date (if it has one)</label><input id="expiry" name="expiry" type="date">' : ''}
<button class="btn" type="submit">Upload securely</button></form>
<p class="muted">For right to work, we may also ask for a share code check. Only ${esc(agency)} can see your document.</p>`;
return [{ json: { html: page(`Upload ${doc.doc_type}`, agency, body) } }];
