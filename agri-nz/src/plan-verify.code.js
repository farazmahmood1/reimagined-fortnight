// POST /webhook/farmplan/verify: the farm manager marks an upload verified, or sends it back with a reason.
// When the last item on a farm is verified, the agent drafts the evidence pack and asks the owner to sign it off.
// Returns { updates, farmUpdates, messages, audit, location }.
const cfg = configFrom();
const body = $('Webhook').first().json.body || {};
const tab = String(body.tab || 'plan');
const items = tableRows('Evidence');
const it = items.find((e) => e.item_id === String(body.id || ''));
const none = { updates: [], farmUpdates: [], messages: [], audit: [] };
const done = (notice, extra = {}) => [{ json: { ...none, ...extra, location: backToConsole(cfg, tab, notice) } }];
if (!it || it.status !== 'received') return done('Nothing to check for that item: it is not waiting for verification.');
const farm = tableRows('Farms').find((f) => f.farm_id === it.farm_id);
const action = String(body.action || '');

if (action === 'back') {
  const reason = String(body.reason || '').trim().slice(0, 300);
  if (reason.length < 5) return done('Say what is wrong, so the provider knows what to fix.');
  const provider = { name: it.provider_name, email: it.provider_email, phone: it.provider_phone };
  const link = `${cfg.base_url}/webhook/farmplan/upload?t=${it.upload_token}`;
  return done(`Sent back to ${it.provider_name}: ${it.requirement}.`, {
    updates: [{ id: it.id, status: 'requested', requests_sent: Number(it.requests_sent || 0) + 1, last_request_at: nowIso(), note: reason, file_name: '', original_name: '', received_at: '' }],
    messages: reach(provider, {
      subject: `Please upload again: ${it.requirement} for ${farm.name}`,
      body: `Kia ora ${firstName(provider.name)},\n\n${farm.manager_name} checked the file you sent for "${it.requirement}" (${farm.name}) and needs a different one.\nReason: ${reason}\n\nPlease upload it again from the secure link. This message is automated.`,
      sms: `Kia ora ${firstName(provider.name)}, ${farm.manager_name} needs a different file for "${it.requirement}" (${farm.name}): ${reason} Upload again here:`,
      link, related: it.item_id, workflow: 'Evidence sent back',
    }),
    audit: [
      auditRow(farm.manager_name, 'person', 'Farm plan', farm.name, `Sent back: ${it.requirement}`, `Reason: ${reason}`),
      auditRow('Agent', 'agent', 'Farm plan', farm.name, `Asked ${provider.name} to upload again`, 'Sent the manager\'s reason with a fresh upload link.'),
    ],
  });
}
if (action !== 'verify') return done('Choose Mark verified or Send back.');

const now = nowIso();
const updates = [{ id: it.id, status: 'verified', verified_at: now, verified_by: farm.manager_name }];
const audit = [auditRow(farm.manager_name, 'person', 'Farm plan', farm.name, `Verified: ${it.requirement}`, `Checked against ${it.original_name || it.file_name}.`)];
const messages = [];
const farmUpdates = [];
const after = items.map((e) => (e.item_id === it.item_id ? { ...e, status: 'verified' } : e));
const mine = farmItems(farm, after);
const c = evidenceCounts(mine);
let notice = `Verified: ${it.requirement} (${c.verified} of ${c.total} for ${farm.name}).`;
if (packStatusFor(farm, mine) === 'Ready for sign-off' && farm.pack_status !== 'Ready for sign-off') {
  const owner = person(cfg, 'owner');
  const link = `${cfg.base_url}/webhook/farmplan/signoff?t=${farm.signoff_token}`;
  farmUpdates.push({ id: farm.id, pack_status: 'Ready for sign-off', ready_at: now });
  messages.push(...reach(owner, {
    subject: `Evidence pack for ${farm.name} is ready for your sign-off`,
    body: `Kia ora ${firstName(owner.name)},\n\nAll ${c.total} evidence items for ${farm.name} are verified, and the agent has drafted the pack for the certifier. Read it, and sign it off if it is right.\n\nNothing goes to ${cfg.certifier_name} until you do.`,
    sms: `Kia ora ${firstName(owner.name)}, the ${farm.name} evidence pack is ready for your sign-off. Nothing goes to the certifier until you do:`,
    link, related: farm.farm_id, workflow: 'Pack ready for sign-off',
  }, 'both'));
  audit.push(auditRow('Agent', 'agent', 'Farm plan', farm.name, 'Drafted the evidence pack', `All ${c.total} items verified. Built from the verified records only.`));
  audit.push(auditRow('Agent', 'agent', 'Farm plan', farm.name, `Asked ${owner.name} to sign off`, 'Sent by email and SMS. Nothing goes to the certifier until the owner signs.'));
  notice += ` The evidence pack is drafted and ${owner.name} has been asked to sign it off.`;
}
return done(notice, { updates, farmUpdates, messages, audit });
