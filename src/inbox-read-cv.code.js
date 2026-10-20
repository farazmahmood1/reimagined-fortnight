// n8n Code node: reads the text out of each applicant's Word CV, locally. PDFs are read after
// the file is stored, by the "Extract from File" node (PDF libraries can't run in the Code sandbox).
// Produces one Applications row per email and the CV file to keep under files/applications.
const settings = settingsFrom(rowsOf('Get settings'));
const maxChars = Number(settings.max_cv_chars) || 6000;
const clean = (t) => String(t || '').replace(/\u0000/g, '').replace(/[ \t]+/g, ' ').replace(/\s*\n\s*/g, '\n').replace(/\n{3,}/g, '\n\n').trim();

const items = $input.all();
const out = [];
for (let i = 0; i < items.length; i++) {
  const a = items[i].json;
  const file = items[i].binary && items[i].binary.cv;
  let text = '';
  let note = '';
  if (file) {
    try {
      const buf = await this.helpers.getBinaryDataBuffer(i, 'cv');
      if (a.cv_ext === 'docx') text = (await require('mammoth').extractRawText({ buffer: buf })).value;
      else if (a.cv_ext !== 'pdf') note = 'Old Word (.doc) file: open it to read';
    } catch (err) {
      note = `Could not read the CV file (${String(err.message || err).slice(0, 100)})`;
    }
    text = clean(text);
    if (!text && !note && a.cv_ext !== 'pdf') note = 'The CV has no text to read';
  } else {
    note = 'No CV attached';
  }

  const appId = 'A' + require('crypto').createHash('sha1').update(a.message_id).digest('hex').slice(0, 10);
  const cvFile = file ? `${appId}.${a.cv_ext}` : '';
  const readable = text.length > 200 || a.cover_text.length > 300;
  out.push({
    json: {
      savePath: cvFile ? `applications/${cvFile}` : '',
      rows: [{
        app_id: appId, message_id: a.message_id, received_at: a.received_at,
        from_name: a.from_name, from_email: a.from_email, subject: a.subject,
        role: a.role, role_source: a.role_source, detect_reason: a.detect_reason,
        cover_text: a.cover_text, cv_file: cvFile, cv_original_name: a.cv_original_name,
        cv_chars: text.length, cv_text: text.slice(0, maxChars), cv_note: note,
        ai_status: a.cv_ext === 'pdf' && !note ? 'reading_pdf' : readable ? 'waiting' : 'nothing_to_read',
        decision: 'new', found_at: nowIso(),
      }],
    },
    binary: file ? { data: file } : undefined,
  });
}
return out;
