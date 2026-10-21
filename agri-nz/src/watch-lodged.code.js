// POST /webhook/register/lodged: a person records that a consent renewal was lodged with the council.
// The agent then explains what that means for operating while the council decides. Returns { updates, audit, location }.
const cfg = configFrom();
const body = $('Webhook').first().json.body || {};
const tab = String(body.tab || 'consents');
const r = tableRows('Register').find((x) => x.reg_id === String(body.id || ''));
const none = { updates: [], audit: [] };
if (!r || r.kind !== 'Consent') return [{ json: { ...none, location: backToConsole(cfg, tab, 'That record is not a consent.') } }];
if (r.renewal_lodged_at) return [{ json: { ...none, location: backToConsole(cfg, tab, `A renewal was already recorded as lodged on ${fmtDate(String(r.renewal_lodged_at).slice(0, 10))}.`) } }];
const when = /^\d{4}-\d{2}-\d{2}$/.test(String(body.date || '')) ? String(body.date) : nzToday();
const st = registerState({ ...r, renewal_lodged_at: when }, cfg, nzToday());
const owner = person(cfg, 'owner');
return [{ json: {
  updates: [{ id: r.id, renewal_lodged_at: when, last_state: st.state }],
  audit: [auditRow(owner.name, 'person', 'Consents', r.type, `Recorded: renewal lodged ${fmtDate(when)}`, st.detail)],
  location: backToConsole(cfg, tab, `Recorded: ${r.type} renewal lodged ${fmtDate(when)}. ${st.detail}`),
} }];
