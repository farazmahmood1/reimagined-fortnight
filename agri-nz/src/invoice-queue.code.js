// GET /webhook/invoices/queue?t=APPROVER_TOKEN: the invoices waiting for this person's decision.
const cfg = configFrom();
const token = String($('Webhook').first().json.query?.t || '');
const role = token && token === cfg.approver_token_owner ? 'owner' : token && token === cfg.approver_token_manager ? 'manager' : '';
if (!role) {
  return [{ json: { html: page('Link not valid', `<h1>This link is no longer valid</h1><p class="muted">Ask ${esc(cfg.admin_name)} for a new one.</p>`) } }];
}
const who = approverFor(role, cfg);
const suppliers = Object.fromEntries(tableRows('Suppliers').map((s) => [s.supplier_id, s]));
const mine = tableRows('Invoices').filter((i) => ['matched', 'flagged'].includes(i.status) && i.approver_role === role)
  .sort((a, b) => (a.status === b.status ? a.invoice_date.localeCompare(b.invoice_date) : a.status === 'flagged' ? -1 : 1));
const total = round2(mine.reduce((s, i) => s + Number(i.total), 0));
const flagged = mine.filter((i) => i.status === 'flagged').length;
const cards = mine.map((i) => {
  const firstFlag = failedChecks(i)[0];
  return `<a class="qcard" href="${cfg.base_url}/webhook/invoices/review?t=${esc(i.review_token)}">
<div class="t"><span>${esc(suppliers[i.supplier_id]?.name)}</span><span>${money(i.total)}</span></div>
<div class="muted">${esc(i.supplier_ref)}, ${esc(i.description)}</div>
<div class="r">${i.status === 'flagged' ? `${pill('warn', 'Flagged')} ${esc(firstFlag ? firstFlag.text : '')}` : `${pill('ok', 'All checks passed')}`}</div></a>`;
}).join('');
const body = `<h1>Kia ora ${esc(firstName(who.name))}</h1>
${mine.length
    ? `<p>${mine.length} invoice${mine.length === 1 ? '' : 's'} waiting for your yes, ${money(total)} in all${flagged ? `, ${flagged} flagged` : ''}. Nothing is approved or paid until you decide.</p>${cards}`
    : callout('ok', '<b>Nothing is waiting for you.</b> Every invoice sent to you has a decision.')}`;
return [{ json: { html: page('Invoices waiting for you', body) } }];
