// POST /webhook/farmplan/deadline: the due date for certified plans moved. Every countdown follows this one setting.
// Returns { configUpdates, audit, location }.
const cfg = configFrom();
const body = $('Webhook').first().json.body || {};
const tab = String(body.tab || 'plan');
const date = String(body.deadline || '');
const row = tableRows('Config').find((r) => r.key === 'plan_deadline');
if (!row || !/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(dateOf(date).getTime())) {
  return [{ json: { configUpdates: [], audit: [], location: backToConsole(cfg, tab, 'Enter the new due date.') } }];
}
if (date === cfg.plan_deadline) return [{ json: { configUpdates: [], audit: [], location: backToConsole(cfg, tab, `The due date is already ${fmtDate(date)}.`) } }];
return [{ json: {
  configUpdates: [{ id: row.id, value: date }],
  audit: [auditRow(cfg.admin_name, 'person', 'Farm plan', 'Due date', `Changed the due date to ${fmtDate(date)}`, `It was ${fmtDate(cfg.plan_deadline)}. Every countdown and message now uses the new date.`)],
  location: backToConsole(cfg, tab, `Due date changed from ${fmtDate(cfg.plan_deadline)} to ${fmtDate(date)}. Nothing else needed to change.`),
} }];
