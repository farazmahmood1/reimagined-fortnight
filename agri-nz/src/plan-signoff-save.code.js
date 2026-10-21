// POST /webhook/farmplan/signoff: the owner signs the pack off. Only then is anything sent to the certifier.
// Returns { farmUpdates, messages, audit, html }.
const cfg = configFrom();
const body = $('Webhook').first().json.body || {};
const token = String(body.t || '');
const farm = tableRows('Farms').find((f) => token && f.signoff_token === token);
const none = { farmUpdates: [], messages: [], audit: [] };
if (!farm) return [{ json: { ...none, html: page('Link not found', `<h1>This link is no longer valid</h1><p class="muted">Ask ${esc(cfg.admin_name)} for a new one.</p>`) } }];
const again = (error) => {
  const events = tableRows('Audit log').filter((a) => a.flow === 'Farm plan' && a.subject === farm.name).sort((a, b) => String(a.at).localeCompare(String(b.at)));
  return [{ json: { ...none, html: page(`Sign off: ${farm.name}`, `${callout('bad', esc(error))}${packBody(farm, tableRows('Evidence'), cfg, events)}<p><a class="btn line" href="${cfg.base_url}/webhook/farmplan/signoff?t=${esc(token)}">Back to the sign-off form</a></p>`, { wide: true, tag: 'Sign-off' }) } }];
};
if (farm.pack_status !== 'Ready for sign-off') {
  return [{ json: { ...none, html: page('Nothing to sign', `<h1>Nothing to sign off</h1>${callout('info', farm.pack_status === 'Sent to certifier' ? `This pack was already signed off by ${esc(farm.signed_by)} and sent to ${esc(farm.sent_to)}.` : 'This pack is not ready: some evidence is still outstanding.')}`) } }];
}
const name = String(body.name || '').trim();
if (body.confirm !== 'yes') return again('Tick the box to confirm you have read the pack.');
if (name.toLowerCase() !== String(cfg.owner_name).toLowerCase()) return again(`Only ${cfg.owner_name} can sign this off. Type the full name exactly.`);

const now = nowIso();
const items = farmItems(farm, tableRows('Evidence'));
const link = `${cfg.base_url}/webhook/farmplan/pack?t=${farm.pack_token}`;
const manager = { name: farm.manager_name, email: farm.manager_email };
return [{ json: {
  farmUpdates: [{ id: farm.id, pack_status: 'Sent to certifier', signed_by: cfg.owner_name, signed_at: now, sent_at: now, sent_to: cfg.certifier_name }],
  messages: [
    msg({ channel: 'Email', to_name: cfg.certifier_name, to_address: cfg.certifier_email, link, related: farm.farm_id, workflow: 'Pack sent to certifier',
      subject: `Evidence pack for ${farm.name}, signed off by ${cfg.owner_name}`,
      body: `Kia ora ${firstName(cfg.certifier_name)},\n\n${cfg.owner_name} has signed off the evidence pack for ${farm.name} (${farm.farm_type}, ${farm.location}). All ${items.length} items are verified and each links to its file.\n\nQuestions go to ${cfg.admin_name} at ${cfg.admin_email}. This message is automated, and was sent only after ${cfg.owner_name} signed.` }),
    msg({ channel: 'Email', to_name: manager.name, to_address: manager.email, link, related: farm.farm_id, workflow: 'Pack sent to certifier',
      subject: `${farm.name} evidence pack signed off and sent`,
      body: `Kia ora ${firstName(manager.name)}, ${cfg.owner_name} signed off the ${farm.name} evidence pack and it has gone to ${cfg.certifier_name}.` }),
  ],
  audit: [
    auditRow(cfg.owner_name, 'person', 'Farm plan', farm.name, 'Signed off the evidence pack', `${items.length} items, all verified. Signed by typing the full name.`),
    auditRow('Agent', 'agent', 'Farm plan', farm.name, `Sent the pack to ${cfg.certifier_name}`, `Emailed ${cfg.certifier_email} with a link to the pack, after ${cfg.owner_name} signed.`),
  ],
  html: page('Signed off', `<h1>Signed off</h1>${callout('ok', `<b>The ${esc(farm.name)} pack has gone to ${esc(cfg.certifier_name)}.</b> It is recorded with your name and the time.`)}<p><a class="btn line" href="${link}">View the pack</a></p>`),
} }];
