// POST /webhook/invoices/new: save a hand-keyed invoice as "new, not checked yet". Checking is a separate step.
// Returns { inserts, audit, location } or, when something is wrong, { html } with the form shown again.
const cfg = configFrom();
const b = $('Webhook').first().json.body || {};
const supplier = tableRows('Suppliers').find((s) => s.supplier_id === String(b.supplier_id || ''));
const qty = Number(b.qty);
const price = Number(b.unit_price);
const gstGiven = String(b.gst ?? '').trim() !== '';
const problems = [];
if (!supplier) problems.push('Choose a supplier.');
if (!String(b.item || '').trim()) problems.push('Say what the invoice is for.');
if (!String(b.ref || '').trim()) problems.push("Enter the supplier's invoice number.");
if (!/^\d{4}-\d{2}-\d{2}$/.test(String(b.invoice_date || ''))) problems.push('Enter the invoice date.');
if (!(qty > 0)) problems.push('The quantity must be more than zero.');
if (!(price > 0)) problems.push('The price per unit must be more than zero.');
if (!String(b.unit || '').trim()) problems.push('Enter the unit, for example t, L or bale.');
if (gstGiven && !(Number(b.gst) >= 0)) problems.push('GST must be a number.');
if (problems.length) return [{ json: { inserts: [], audit: [], html: page('Add an invoice', newInvoiceBody(cfg, b, problems.join(' ')), { wide: true, tag: 'Add an invoice' }) } }];

const year = nzToday().slice(0, 4);
const next = tableRows('Invoices').map((i) => Number(String(i.invoice_id).split('-').pop())).filter(Number.isFinite).reduce((m, n) => Math.max(m, n), 1000) + 1;
const net = round2(qty * price);
const gst = gstGiven ? round2(Number(b.gst)) : round2(net * Number(cfg.gst_rate || 0.15));
const item = String(b.item).trim().slice(0, 80);
const inv = {
  invoice_id: `INV-${year}-${next}`, supplier_id: supplier.supplier_id, supplier_ref: String(b.ref).trim().slice(0, 40), invoice_date: b.invoice_date,
  due_date: dueDateFor(b.invoice_date, Number(cfg.pay_day || 20)), item, description: `${item}, ${qtyText(qty)} ${unitText(qty, String(b.unit).trim())}`,
  qty, unit: String(b.unit).trim().slice(0, 12), unit_price: price, net, gst, total: round2(net + gst), bank_account: String(b.bank_account || '').trim().slice(0, 30),
  docket_ref: String(b.docket_ref || '').trim().slice(0, 30), source: 'Keyed in by hand', received_at: nowIso(), status: 'received', contract_id: '', result: '', reasons: '',
  at_risk: 0, checked_at: '', approver_role: '', approver_name: '', review_token: '', approval_requested_at: '', decision: '', decided_at: '', decided_by: '', decision_note: '', payment_file: '',
};
const notice = `Added ${inv.invoice_id} from ${supplier.name} (${money(inv.total)}). Press "Check new invoices" to have the agent check it.`;
return [{ json: {
  inserts: [inv],
  audit: [auditRow(cfg.admin_name, 'person', 'Invoices', inv.invoice_id, 'Added an invoice by hand', `${supplier.name} ${inv.supplier_ref}, ${money(inv.total)}. In production this is read from the invoice inbox.`)],
  location: backToConsole(cfg, 'invoices', notice),
} }];
