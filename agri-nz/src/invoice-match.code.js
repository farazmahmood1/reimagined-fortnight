// "Check new invoices": reads every invoice that has not been checked, matches it to its contract and delivery docket,
// runs the checks, and asks the right person for a decision. It never approves or pays anything.
// Returns { updates, messages, audit, summary }.
const cfg = configFrom();
const base = cfg.base_url;
const ctx = {
  cfg,
  suppliers: Object.fromEntries(tableRows('Suppliers').map((s) => [s.supplier_id, s])),
  contracts: tableRows('Contracts'),
  dockets: tableRows('Dockets'),
  invoices: tableRows('Invoices'),
  used: {},
};
// How much of each contract is already used: approved, scheduled and paid invoices, plus clean ones waiting for approval.
for (const i of ctx.invoices) {
  if (i.contract_id && ['matched', 'approved', 'scheduled', 'paid'].includes(i.status)) ctx.used[i.contract_id] = (ctx.used[i.contract_id] || 0) + Number(i.qty);
}
const pending = ctx.invoices.filter((i) => i.status === 'received').sort((a, b) => String(a.received_at).localeCompare(String(b.received_at)) || a.invoice_id.localeCompare(b.invoice_id));
if (!pending.length) return [{ json: { updates: [], messages: [], audit: [], summary: 'No new invoices to check.' } }];

const now = nowIso();
const updates = [];
const audit = [];
const queue = { owner: [], manager: [] };
for (const inv of pending) {
  const r = checkInvoice(inv, ctx);
  if (r.contract && r.result === 'Clean') ctx.used[r.contract.contract_id] = (ctx.used[r.contract.contract_id] || 0) + Number(inv.qty);
  const approver = approverFor(r.approver_role, cfg);
  const supplier = ctx.suppliers[inv.supplier_id];
  const reviewToken = newToken();
  updates.push({
    id: inv.id, status: r.result === 'Clean' ? 'matched' : 'flagged', contract_id: r.contract ? r.contract.contract_id : '', result: r.result,
    reasons: JSON.stringify(r.checks), at_risk: r.at_risk, checked_at: now, due_date: r.due_date, approver_role: r.approver_role,
    approver_name: approver.name, review_token: reviewToken, approval_requested_at: now,
  });
  queue[r.approver_role].push({ inv, r, supplier, link: `${base}/webhook/invoices/review?t=${reviewToken}` });
  audit.push(auditRow('Agent', 'agent', 'Invoices', inv.invoice_id,
    r.result === 'Clean' ? 'Matched to contract' : 'Flagged for review',
    r.result === 'Clean' ? `${supplier.name} ${inv.supplier_ref}, ${money(inv.total)}. ${r.contract.contract_id}: all 7 checks passed. Needs ${approver.name}.` : `${supplier.name} ${inv.supplier_ref}, ${money(inv.total)}. ${r.summary}`));
}

// One digest per approver, not one message per invoice.
const messages = [];
for (const role of ['owner', 'manager']) {
  const items = queue[role];
  if (!items.length) continue;
  const who = approverFor(role, cfg);
  const flagged = items.filter((x) => x.r.result === 'Review');
  const clean = items.filter((x) => x.r.result === 'Clean');
  const total = round2(items.reduce((s, x) => s + Number(x.inv.total), 0));
  const line = (x) => `- ${x.supplier.name} ${x.inv.supplier_ref}, ${x.inv.description}: ${money(x.inv.total)}${x.r.result === 'Review' ? `. FLAGGED: ${x.r.checks.find((c) => !c.ok).text}` : ''}\n  ${x.link}`;
  const queueLink = `${base}/webhook/invoices/queue?t=${who.token}`;
  messages.push(msg({
    channel: 'Email', to_name: who.name, to_address: who.email, link: queueLink, related: `${items.length} invoices`, workflow: 'Invoice approval request',
    subject: `${items.length} invoice${items.length === 1 ? '' : 's'} waiting for your yes (${money(total)})${flagged.length ? `, ${flagged.length} flagged` : ''}`,
    body: [`Kia ora ${firstName(who.name)},`, '',
      `${items.length} supplier invoice${items.length === 1 ? ' is' : 's are'} waiting for your decision, ${money(total)} in all. The farm admin agent has checked each one against its contract and delivery docket.`,
      flagged.length ? `\nFlagged, so please look closely:\n${flagged.map(line).join('\n')}` : '',
      clean.length ? `\nAll checks passed:\n${clean.map(line).join('\n')}` : '',
      '', 'Nothing is approved or paid until you decide. This message is automated.'].filter((x) => x !== '').join('\n'),
  }));
  messages.push(...reach({ name: who.name, phone: who.phone }, {
    sms: `Kia ora ${firstName(who.name)}, ${items.length} invoice${items.length === 1 ? '' : 's'} (${money(total)}) need your yes${flagged.length ? `, ${flagged.length} flagged` : ''}. Nothing is paid until you decide:`,
    link: queueLink, related: `${items.length} invoices`, workflow: 'Invoice approval request',
  }, 'sms'));
  audit.push(auditRow('Agent', 'agent', 'Invoices', `${items.length} invoices`, `Asked ${who.name} (${who.title}) to decide`, `${flagged.length} flagged, ${clean.length} clean, ${money(total)}. Sent by email and SMS.`));
}

const flaggedTotal = updates.filter((u) => u.result === 'Review').length;
return [{ json: { updates, messages, audit, summary: `Checked ${pending.length} invoices: ${pending.length - flaggedTotal} clean, ${flaggedTotal} flagged for review. Nothing is approved or paid until a person decides.` } }];
