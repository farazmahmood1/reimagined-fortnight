// POST /webhook/invoices/review: a person approves, approves anyway (with a reason), queries the supplier or rejects.
// The agent never decides. Returns { updates, messages, audit, html }.
const cfg = configFrom();
const body = $('Webhook').first().json.body || {};
const token = String(body.t || '');
const decision = String(body.decision || '');
const note = String(body.note || '').trim().slice(0, 500);
const inv = tableRows('Invoices').find((i) => token && i.review_token === token);
const none = { updates: [], messages: [], audit: [] };
if (!inv) return [{ json: { ...none, html: page('Link not found', `<h1>This link is no longer valid</h1><p class="muted">Ask ${esc(cfg.admin_name)} for a new one.</p>`) } }];

const sup = supplierOf(inv);
const approver = approverFor(inv.approver_role, cfg);
const back = `<p><a class="btn line" href="${cfg.base_url}/webhook/invoices/queue?t=${esc(approver.token)}">Back to your list</a></p>`;
if (!['matched', 'flagged'].includes(inv.status)) {
  return [{ json: { ...none, html: page('Already decided', `<h1>Already decided</h1>${callout('info', `This invoice is <b>${esc((INVOICE_STATUS[inv.status] || ['', inv.status])[1].toLowerCase())}</b>. Nothing more to do.`)}${back}`) } }];
}
const again = (error, extra = {}) => [{ json: { ...none, html: page(`Invoice ${inv.supplier_ref}`, reviewBody(inv, cfg, { error, ...extra })) } }];
const failed = failedChecks(inv);
const now = nowIso();
const decided = { decided_at: now, decided_by: approver.name, decision_note: note };

if (decision === 'approve') {
  if (failed.length) return again('This invoice is flagged. Ask the supplier, reject it, or approve it anyway and say why.');
  return [{ json: { ...none,
    updates: [{ id: inv.id, status: 'approved', decision: 'approved', ...decided }],
    audit: [auditRow(approver.name, 'person', 'Invoices', inv.invoice_id, 'Approved', `${sup.name} ${inv.supplier_ref}, ${money(inv.total)}. Due ${fmtDate(inv.due_date)}.`)],
    html: page('Approved', `<h1>Approved</h1>${callout('ok', `<b>${money(inv.total)} to ${esc(sup.name)} is approved.</b> It goes into the payment file for ${fmtDate(inv.due_date)}. The agent has not paid anything: you upload the payment file to your bank yourself.`)}${back}`),
  } }];
}
if (decision === 'approve_anyway') {
  if (!failed.length) return again('Nothing was flagged on this invoice, so there is nothing to approve anyway. Use Approve.');
  if (note.length < 8) return again('Say why it is safe to pay, in a sentence. Your reason goes into the record.', { note });
  return [{ json: { ...none,
    updates: [{ id: inv.id, status: 'approved', decision: 'approved anyway', ...decided }],
    audit: [auditRow(approver.name, 'person', 'Invoices', inv.invoice_id, 'Approved anyway', `Overrode: ${failed.map((c) => c.label.toLowerCase()).join(', ')}. Reason: ${note}`)],
    html: page('Approved', `<h1>Approved anyway</h1>${callout('warn', `<b>${money(inv.total)} to ${esc(sup.name)} is approved.</b> Your reason is in the record. Payment goes to the bank account on file${failed.some((c) => c.id === 'bank') ? ', not the account on the invoice' : ''}.`)}${back}`),
  } }];
}
if (decision === 'query') {
  const text = String(body.query_text || '').trim().slice(0, 2500);
  if (text.length < 30) return again('Write the message to the supplier, or keep the draft.', { query_text: text });
  return [{ json: { ...none,
    updates: [{ id: inv.id, status: 'queried', decision: 'queried', ...decided, decision_note: 'Question sent to the supplier.' }],
    messages: [msg({ channel: 'Email', to_name: sup.contact_name, to_address: sup.contact_email, subject: `Question about invoice ${inv.supplier_ref}`, body: `${text}\n\nSent for ${approver.name} at ${cfg.business_name}.`, related: inv.invoice_id, workflow: 'Invoice query' })],
    audit: [
      auditRow(approver.name, 'person', 'Invoices', inv.invoice_id, 'Approved the question to the supplier', `${failed.length} flag${failed.length === 1 ? '' : 's'} on ${sup.name} ${inv.supplier_ref}.`),
      auditRow('Agent', 'agent', 'Invoices', inv.invoice_id, 'Sent the question to the supplier', `Emailed ${sup.contact_name} at ${sup.name}, after ${approver.name} approved the wording.`),
    ],
    html: page('Question sent', `<h1>Question sent</h1>${callout('ok', `<b>${esc(sup.contact_name)} at ${esc(sup.name)} has your question.</b> The invoice is on hold. When a corrected invoice arrives, add it and the agent checks it again.`)}${back}`),
  } }];
}
if (decision === 'reject') {
  return [{ json: { ...none,
    updates: [{ id: inv.id, status: 'rejected', decision: 'rejected', ...decided }],
    audit: [auditRow(approver.name, 'person', 'Invoices', inv.invoice_id, 'Rejected', `${sup.name} ${inv.supplier_ref}, ${money(inv.total)}.${note ? ` Reason: ${note}` : ''}`)],
    html: page('Rejected', `<h1>Rejected</h1>${callout('info', `<b>Invoice ${esc(inv.supplier_ref)} is rejected.</b> It will not be paid.`)}${back}`),
  } }];
}
return again('Choose one of the options below.');
