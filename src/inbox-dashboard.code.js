// n8n Code node: renders the job applications page (GET /webhook/applications).
// Builds the data for the page; the layout and behaviour live in inbox-dashboard.client.js/.css.
// No score and no ranking: the page lists facts and a checklist; people make the decisions.
const settings = settingsFrom(rowsOf('Get settings'));
const roles = rolesFrom(rowsOf('Get roles'));
const apps = rowsOf('Get applications').sort((a, b) => String(b.received_at).localeCompare(String(a.received_at)));
const q = $('Open applications page').first().json.query || {};
const demo = q.demo === '1';
const roleOf = (a) => a.role || (a.ai_role_guess && a.ai_role_guess !== 'None' ? a.ai_role_guess : '') || 'Role not stated';

// Demo mode: replace the applicant's name and email wherever they appear (subject, summary, evidence).
const scrubber = (a) => {
  if (!demo) return (s) => String(s ?? '');
  const words = [...String(a.from_name || '').split(/[^A-Za-zÀ-ž]+/), String(a.from_email || '').split('@')[0]]
    .filter((w) => w && w.length >= 3).map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const re = words.length ? new RegExp(`\\b(${words.join('|')})\\b`, 'gi') : null;
  return (s) => {
    let t = String(s ?? '').replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, '[email]');
    return re ? t.replace(re, '[name]') : t;
  };
};
const list = (json, clean) => parseJson(json || '[]', []).map((c) => ({ i: clean(c.item), s: c.status, e: clean(c.evidence) }));

// Demo mode shows the fictional sample workspace (built in the browser), never real applicants.
const data = demo ? [] : apps.map((a) => {
  const clean = scrubber(a);
  const code = String(a.app_id).slice(-4).toUpperCase();
  return {
    id: a.app_id,
    name: demo ? `Candidate ${code}` : a.from_name || a.from_email,
    email: demo ? '' : a.from_email,
    at: a.received_at,
    subject: demo ? clean(a.subject) : a.subject,
    role: roleOf(a),
    roleGuessed: !a.role && !!a.ai_role_guess && a.ai_role_guess !== 'None',
    status: a.ai_status,
    decision: a.decision || 'new',
    why: a.detect_reason,
    cv: a.cv_file ? (demo ? 'demo' : `${BASE_URL}/webhook/applications/cv?id=${encodeURIComponent(a.app_id)}`) : '',
    cvName: demo ? '' : a.cv_original_name,
    cvNote: a.cv_note,
    cover: demo ? '' : String(a.cover_text || '').slice(0, 500),
    summary: clean(a.ai_summary),
    title: clean(a.ai_current_title), exp: a.ai_experience, loc: a.ai_location, avail: a.ai_availability,
    must: list(a.ai_must_haves, clean), nice: list(a.ai_nice_to_haves, clean),
    qs: parseJson(a.ai_questions || '[]', []).map(clean),
    model: a.ai_model, tokens: a.ai_tokens || 0, error: a.ai_error, aiAt: a.ai_at,
  };
});

const state = {
  base: BASE_URL, demo, sample: demo, notice: q.done ? String(q.done) : '',
  roles: [...roles.map((r) => r.role), 'Role not stated'],
  ai: { on: settings.ai_enabled === 'true', model: settings.ai_model, batch: Number(settings.ai_batch_size) || 10, maxChars: Number(settings.max_cv_chars) || 6000 },
};
const json = (v) => JSON.stringify(v).replace(/</g, '\\u003c');

const html = `<!doctype html><html lang="en-GB"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Applications · Forrof</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap">
<style>${CLIENT_CSS}</style></head><body>
<div id="app"></div>
<script id="state" type="application/json">${json(state)}</script>
<script id="data" type="application/json">${json(data)}</script>
<script>${CLIENT_JS}</script>
</body></html>`;
return [{ json: { html } }];
