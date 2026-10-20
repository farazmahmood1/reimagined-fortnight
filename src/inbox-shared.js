// Helpers for the inbox triage Code nodes, injected after shared.js by scripts/build-workflows.mjs.
// DEFAULT_ROLES, DEFAULT_SETTINGS and BASE_URL are injected by the build script.
const rowsOf = (node) => {
  try { return $(node).all().map((i) => i.json).filter((r) => r && r.id !== undefined); } catch { return []; }
};
const splitList = (s) => String(s || '').split(',').map((x) => x.trim().toLowerCase()).filter(Boolean);
const splitLines = (s) => String(s || '').split('\n').map((x) => x.trim()).filter(Boolean);
const settingsFrom = (rows) => ({
  ...Object.fromEntries(DEFAULT_SETTINGS.map((s) => [s.key, s.value])),
  ...Object.fromEntries(rows.filter((r) => r.key).map((r) => [r.key, String(r.value ?? '')])),
});
const rolesFrom = (rows) => {
  const list = rows.filter((r) => r.role).length ? rows.filter((r) => r.role) : DEFAULT_ROLES;
  return list.map((r) => ({ role: r.role, keywords: splitList(r.keywords), must_haves: splitLines(r.must_haves), nice_to_haves: splitLines(r.nice_to_haves) }));
};
// Subject matches count 3, body matches 1. Ties go to the role listed first.
function matchRole(roles, subject, body) {
  const s = ` ${String(subject || '').toLowerCase()} `;
  const b = ` ${String(body || '').slice(0, 2000).toLowerCase()} `;
  let best = { role: '', score: 0, source: 'unclear' };
  for (const r of roles) {
    let score = 0;
    let inSubject = false;
    for (const k of r.keywords) {
      if (s.includes(k)) { score += 3; inSubject = true; } else if (b.includes(k)) score += 1;
    }
    if (score > best.score) best = { role: r.role, score, source: inSubject ? 'subject' : 'body' };
  }
  return best;
}
const parseJson = (s, fallback) => { try { return JSON.parse(s); } catch { return fallback; } };
