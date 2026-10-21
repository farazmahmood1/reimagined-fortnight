// POST /webhook/farmplan/rule: a requirement is added to the checklist (the certifier or regulator changed the rules).
// It becomes an open item on every farm it applies to, and any pack that was ready or sent is reopened.
// Returns { reqInserts, evidenceInserts, farmUpdates, messages, audit, location }.
const cfg = configFrom();
const body = $('Webhook').first().json.body || {};
const tab = String(body.tab || 'plan');
const none = { reqInserts: [], evidenceInserts: [], farmUpdates: [], messages: [], audit: [] };
const requirement = String(body.requirement || '').trim().slice(0, 160);
if (requirement.length < 6) return [{ json: { ...none, location: backToConsole(cfg, tab, 'Describe the new requirement in a few words.') } }];
const farms = tableRows('Farms');
const types = [...new Set(farms.map((f) => f.farm_type))];
const appliesTo = types.includes(String(body.applies_to)) ? String(body.applies_to) : 'All';
const category = String(body.category || 'Other').trim().slice(0, 40) || 'Other';
if (tableRows('Requirements').some((r) => r.requirement.toLowerCase() === requirement.toLowerCase())) {
  return [{ json: { ...none, location: backToConsole(cfg, tab, `"${requirement}" is already on the checklist.`) } }];
}
const nextNum = tableRows('Requirements').map((r) => Number(String(r.req_id).replace(/\D/g, ''))).reduce((m, n) => Math.max(m, n), 0) + 1;
const reqId = `R${String(nextNum).padStart(2, '0')}`;
const affected = farms.filter((f) => appliesTo === 'All' || f.farm_type === appliesTo);

const reopened = affected.filter((f) => f.pack_status !== 'Collecting');
const audit = [auditRow(cfg.admin_name, 'person', 'Farm plan', 'Checklist', `Added a requirement: ${requirement}`, `Applies to ${appliesTo === 'All' ? 'every farm' : appliesTo}: ${affected.length} farm${affected.length === 1 ? '' : 's'}.`)];
for (const f of reopened) audit.push(auditRow('Agent', 'agent', 'Farm plan', f.name, 'Reopened the evidence pack', `New requirement: ${requirement}. It was "${f.pack_status.toLowerCase()}".`));
const owner = person(cfg, 'owner');
return [{ json: {
  reqInserts: [{ req_id: reqId, requirement, category, applies_to: appliesTo, provider_name: '', provider_email: '', provider_phone: '' }],
  evidenceInserts: affected.map((f) => ({
    item_id: `E-${f.farm_id}-${reqId}`, farm_id: f.farm_id, req_id: reqId, requirement, category, provider_name: f.manager_name, provider_email: f.manager_email, provider_phone: f.manager_phone,
    status: 'missing', upload_token: newToken(), file_name: '', original_name: '', received_at: '', verified_at: '', verified_by: '', requests_sent: 0, last_request_at: '', note: '',
  })),
  farmUpdates: affected.map((f) => ({ id: f.id, pack_status: 'Collecting', ready_at: '', signed_by: '', signed_at: '', sent_at: '', sent_to: '' })),
  messages: reopened.length ? reach(owner, { subject: `Checklist changed: ${requirement}`, body: `Kia ora ${firstName(owner.name)},\n\n"${requirement}" was added to the farm plan checklist. ${reopened.map((f) => f.name).join(', ')} ${reopened.length === 1 ? 'was' : 'were'} reopened, so the pack needs sign-off again once the new item is in.`, link: `${cfg.base_url}/webhook/console?tab=plan`, related: reqId, workflow: 'Checklist changed' }, 'email') : [],
  audit,
  location: backToConsole(cfg, tab, `Added "${requirement}" to ${affected.length} farm${affected.length === 1 ? '' : 's'}.${reopened.length ? ` ${reopened.length} evidence pack${reopened.length === 1 ? '' : 's'} reopened.` : ''} Press "Chase farm plan evidence" to ask for it.`),
} }];
