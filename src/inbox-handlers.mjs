// Small Code-node bodies for the inbox triage workflow (used by build-workflows.mjs).

// Query parameters the applications page keeps when it sends you back to it.
const KEEP = `
const keepQuery = (q, extra) => {
  const p = {};
  for (const k of ['demo', 'role', 'decision', 'q', 'sort', 'id']) if (q && q[k]) p[k] = String(q[k]);
  Object.assign(p, extra);
  return Object.entries(p).map(([k, v]) => k + '=' + encodeURIComponent(v)).join('&');
};
`;

export const backToPage = (trigger) => `${KEEP}
// Return to the applications page with a one-line notice.
const q = $('${trigger}').first().json.query || {};
const notice = $input.first().json.notice || 'Done.';
return [{ json: { location: BASE_URL + '/webhook/applications?' + keepQuery(q, { done: notice }) } }];
`;

export const MARK = `${KEEP}
// GET /webhook/applications/mark?id=A…&d=shortlisted|not_now|new: a person records their decision.
const q = $('Mark decision').first().json.query || {};
const app = rowsOf('Get applications').find((r) => r.app_id === String(q.id || ''));
const d = ['shortlisted', 'interview', 'not_now', 'new'].includes(q.d) ? q.d : '';
const label = { shortlisted: 'Shortlisted', interview: 'Moved to interview:', not_now: 'Marked "not now":', new: 'Moved back to "not reviewed":' }[d];
const ok = !!(app && d);
const notice = ok ? label + ' ' + (q.demo === '1' ? 'candidate' : app.from_name || app.from_email) : 'Nothing changed.';
return [{ json: {
  updates: ok ? [{ id: app.id, decision: d, decided_at: nowIso() }] : [],
  location: BASE_URL + '/webhook/applications?' + keepQuery(q, { done: notice }),
} }];
`;

export const SETTING = `${KEEP}
// POST /webhook/applications/settings (run=ai_on | ai_off): switches AI summaries on or off.
const req = $('Change setting').first().json;
const run = String((req.body && req.body.run) || '');
const value = run === 'ai_on' ? 'true' : run === 'ai_off' ? 'false' : '';
const row = rowsOf('Get settings').find((r) => r.key === 'ai_enabled');
const notice = value === 'true' ? 'AI summaries are on. Nothing is sent until you click "Summarise".' : value === 'false' ? 'AI summaries are off.' : 'Nothing changed.';
return [{ json: {
  updates: value && row ? [{ id: row.id, value }] : [],
  inserts: value && !row ? [{ key: 'ai_enabled', value }] : [],
  location: BASE_URL + '/webhook/applications?' + keepQuery(req.query, { done: notice }),
} }];
`;

export const CV_FILE = `
// GET /webhook/applications/cv?id=A…: opens the stored CV (local machine only).
const id = String($('View CV').first().json.query?.id || '');
const app = rowsOf('Get applications').find((r) => r.app_id === id);
const ok = !!(app && /^A[0-9a-f]{10}\\.(pdf|docx|doc)$/.test(app.cv_file || ''));
const safeName = ok ? String(app.cv_original_name || app.cv_file).replace(/[^A-Za-z0-9 ._()-]/g, '_') : '';
const html = ok ? '' : page('Not found', 'Forrof', '<h1>No CV on file</h1><p class="muted">This application has no stored CV.</p>');
return [{ json: { ok, filePath: ok ? 'applications/' + app.cv_file : '', fileName: safeName, html } }];
`;

export const PICK_PDFS = `
// Stored PDF CVs whose text hasn't been read yet, up to 100 per run.
const rows = rowsOf('Get applications').filter((r) => /\\.pdf$/.test(r.cv_file || '') && !(Number(r.cv_chars) > 0)
  && (r.ai_status === 'reading_pdf' || /^Could not read the CV file \\(Cannot assign/.test(r.cv_note || '')));
return rows.slice(0, 100).map((r) => ({ json: { id: r.id, cv_file: r.cv_file, cover_len: String(r.cover_text || '').length, filePath: 'applications/' + r.cv_file } }));
`;

export const PDF_TEXT = `
// Saves the text read from each PDF CV (cut to max_cv_chars) and queues it for the AI summary.
const settings = settingsFrom(rowsOf('Get settings'));
const maxChars = Number(settings.max_cv_chars) || 6000;
const clean = (t) => String(t || '').replace(/\\u0000/g, '').replace(/[ \\t]+/g, ' ').replace(/\\s*\\n\\s*/g, '\\n').replace(/\\n{3,}/g, '\\n\\n').trim();
const picked = $('Pick unread PDFs').all();
const read = $input.all();
const updates = picked.map((p, i) => {
  const r = (read[i] && read[i].json) || {};
  const text = clean(r.text);
  const note = r.error ? 'Could not read the PDF (it may be password-protected or damaged)' : text ? '' : 'The CV is a scanned image with no text to read';
  const readable = text.length > 200 || p.json.cover_len > 300;
  return { id: p.json.id, cv_chars: text.length, cv_text: text.slice(0, maxChars), cv_note: note, ai_status: readable ? 'waiting' : 'nothing_to_read' };
});
return [{ json: { updates } }];
`;

export const SEED = `
// Copies the starting roles and settings into their tables, only where they are missing.
const haveRoles = rowsOf('Get roles').length > 0;
const haveKeys = new Set(rowsOf('Get settings').map((r) => r.key));
const roles = haveRoles ? [] : DEFAULT_ROLES;
const settings = DEFAULT_SETTINGS.filter((s) => !haveKeys.has(s.key));
const summary = 'Tables ready. Added ' + roles.length + ' role(s) and ' + settings.length + ' setting(s).';
return [{ json: { roles, settings, summary, html: '<p>' + summary + '</p>' } }];
`;
