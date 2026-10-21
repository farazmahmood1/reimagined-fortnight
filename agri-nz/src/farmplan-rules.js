// Farm plan evidence: item states, pack status and the draft evidence pack page. Injected into the nodes that use them.
const EVIDENCE_PILL = { missing: ['bad', 'Missing'], requested: ['warn', 'Requested'], received: ['info', 'Check needed'], verified: ['ok', 'Verified'] };
const evidencePill = (item) => { const [tone, label] = EVIDENCE_PILL[item.status] || ['grey', item.status]; return pill(tone, label); };
const PACK_PILL = { Collecting: ['warn', 'Collecting evidence'], 'Ready for sign-off': ['info', 'Ready for sign-off'], 'Sent to certifier': ['ok', 'Sent to certifier'] };
const packPill = (farm) => { const [tone, label] = PACK_PILL[farm.pack_status] || ['grey', farm.pack_status]; return pill(tone, label); };

const farmItems = (farm, items) => items.filter((i) => i.farm_id === farm.farm_id);
const evidenceCounts = (items) => ({
  total: items.length,
  verified: items.filter((i) => i.status === 'verified').length,
  received: items.filter((i) => i.status === 'received').length,
  requested: items.filter((i) => i.status === 'requested').length,
  missing: items.filter((i) => i.status === 'missing').length,
});
// A pack is ready once every item is verified. A pack that has been signed off and sent stays sent until the rules change.
const packStatusFor = (farm, items) => {
  if (farm.pack_status === 'Sent to certifier') return 'Sent to certifier';
  return items.length && items.every((i) => i.status === 'verified') ? 'Ready for sign-off' : 'Collecting';
};
const deadlineText = (cfg, today) => {
  if (!cfg.plan_deadline) return '';
  const n = daysBetween(today, cfg.plan_deadline);
  return `${fmtDate(cfg.plan_deadline)} (${n >= 0 ? `${n} days to go` : `${-n} days ago`})`;
};
// Whose phone or email an evidence request goes to: the named provider, or the farm's own manager.
const providerFor = (req, farm) => (req.provider_name
  ? { name: req.provider_name, email: req.provider_email || '', phone: req.provider_phone || '' }
  : { name: farm.manager_name, email: farm.manager_email, phone: farm.manager_phone });

// The pack: what the certifier receives after a person signs it off. Built only from records a person has verified.
const packBody = (farm, items, cfg, events) => {
  const mine = farmItems(farm, items);
  const c = evidenceCounts(mine);
  const today = nzToday();
  const outstanding = mine.filter((i) => i.status !== 'verified');
  const rows = mine.map((i) => `<tr><td>${esc(i.requirement)}<div class="muted">${esc(i.category)}</div></td><td>${esc(i.provider_name || farm.manager_name)}</td>
    <td>${i.file_name ? `<a href="${cfg.base_url}/webhook/farmplan/file?p=${farm.pack_token}&amp;id=${esc(i.item_id)}" target="_blank">${esc(i.original_name || i.file_name)}</a>` : '<span class="muted">No file</span>'}</td>
    <td>${evidencePill(i)}${i.verified_at ? `<div class="muted">${esc(i.verified_by)}, ${fmtDate(i.verified_at)}</div>` : ''}</td></tr>`).join('');
  const status = farm.pack_status === 'Sent to certifier'
    ? callout('ok', `<b>Signed off and sent.</b> ${esc(farm.signed_by)} signed this pack off on ${fmtLong(String(farm.signed_at).slice(0, 10))} and it was sent to ${esc(farm.sent_to)}.`)
    : farm.pack_status === 'Ready for sign-off'
      ? callout('info', `<b>Ready for sign-off.</b> All ${c.total} items are verified. Nothing is sent to the certifier until a person signs this off.`)
      : callout('warn', `<b>Not ready.</b> ${c.total - c.verified} of ${c.total} items are still outstanding.`);
  const history = (events || []).slice(-14).map((e) => `<tr><td class="muted">${fmtTime(e.at)}</td><td>${esc(e.actor)}</td><td>${esc(e.action)}</td></tr>`).join('');
  return `<div class="sheet">
<h1>Evidence pack for ${esc(farm.name)}</h1>
<p class="muted">Draft prepared by the farm admin agent from records a person has verified. It is not the freshwater farm plan itself: the plan is prepared in the format your certifier and regional council require.</p>
${status}
<table class="kv">
<tr><td>Farm</td><td>${esc(farm.name)}, ${esc(farm.farm_type)}, ${esc(farm.location)}, ${esc(farm.region)}</td></tr>
<tr><td>Area</td><td>${Number(farm.area_ha).toLocaleString('en-NZ')} ha</td></tr>
<tr><td>Farm manager</td><td>${esc(farm.manager_name)}</td></tr>
<tr><td>Certifier</td><td>${esc(cfg.certifier_name)}</td></tr>
<tr><td>Due date for certified plans</td><td>${esc(deadlineText(cfg, today))}</td></tr>
<tr><td>Evidence verified</td><td>${c.verified} of ${c.total}</td></tr>
</table>
<h2>Evidence index</h2>
<table class="list"><tr><th>Evidence</th><th>Supplied by</th><th>File</th><th>Status</th></tr>${rows}</table>
${outstanding.length ? `<h2>Still outstanding</h2><ul>${outstanding.map((i) => `<li>${esc(i.requirement)} (${esc(i.status)})</li>`).join('')}</ul>` : ''}
<h2>What happened</h2>
<table class="list"><tr><th>When</th><th>Who</th><th>What</th></tr>${history || '<tr><td colspan="3" class="muted">No events yet.</td></tr>'}</table>
<p class="muted">The checklist is an example set by ${esc(cfg.business_name)}. Confirm with your certifier what a plan needs.</p>
</div>`;
};
