// "Build payment file": approved invoices that are due by the next pay date go into one CSV for the bank.
// The agent never pays anyone. A person uploads the file to the bank and approves it there.
// Payments always use the bank account on file, never the one printed on an invoice.
// Returns { updates, runs, messages, audit, fileName, summary } and the CSV as binary "data".
const cfg = configFrom();
const today = nzToday();
const payDay = Number(cfg.pay_day || 20);
const payDate = nextPayDate(today, payDay);
const suppliers = Object.fromEntries(tableRows('Suppliers').map((s) => [s.supplier_id, s]));
const approved = tableRows('Invoices').filter((i) => i.status === 'approved' && !i.payment_file);
const ready = approved.filter((i) => (i.due_date || dueDateFor(i.invoice_date, payDay)) <= payDate)
  .sort((a, b) => suppliers[a.supplier_id].name.localeCompare(suppliers[b.supplier_id].name) || a.invoice_date.localeCompare(b.invoice_date));
const later = approved.length - ready.length;

if (!ready.length) {
  return [{ json: { updates: [], runs: [], messages: [], audit: [], fileName: '', summary: `No approved invoices are due by ${fmtDate(payDate)}.${later ? ` ${later} approved invoice${later === 1 ? ' is' : 's are'} due later.` : ''}` } }];
}

const csvCell = (v) => { const s = String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
const header = ['Pay date', 'Payee', 'Bank account (on file)', 'Amount (NZD, incl GST)', 'Particulars', 'Code', 'Reference', 'Invoice number', 'Invoice date', 'Net (ex GST)', 'GST', 'Approved by', 'Approved on', 'Flag overridden'];
let total = 0;
const lines = ready.map((i) => {
  const s = suppliers[i.supplier_id];
  total += Number(i.total);
  const overridden = i.decision === 'approved anyway' ? i.decision_note : '';
  return [fmtDate(payDate), s.name, s.bank_account, Number(i.total).toFixed(2), s.name.slice(0, 12).toUpperCase(), String(i.supplier_ref).slice(0, 12), 'TUSSOCK RIDGE', i.supplier_ref, i.invoice_date,
    Number(i.net).toFixed(2), Number(i.gst).toFixed(2), i.decided_by, i.decided_at ? String(i.decided_at).slice(0, 10) : '', overridden].map(csvCell).join(',');
});
total = round2(total);
lines.push(['TOTAL', '', '', total.toFixed(2), '', '', '', `${ready.length} invoices`, '', '', '', '', '', ''].map(csvCell).join(','));
const csv = [header.join(','), ...lines].join('\r\n') + '\r\n';

const stamp = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15);
const fileName = `payment-run-${payDate}-${stamp}.csv`;
const now = nowIso();
const owner = person(cfg, 'owner');
const admin = person(cfg, 'admin');
const link = `${cfg.base_url}/webhook/payments/file?name=${encodeURIComponent(fileName)}`;
const text = `${ready.length} approved invoice${ready.length === 1 ? '' : 's'}, ${money(total)}, due ${fmtDate(payDate)}. The agent has not paid anyone. Upload the file to your bank and approve it there. Every invoice in it was approved by a person, and every payee is paid to the account on file.`;
return [{
  json: {
    updates: ready.map((i) => ({ id: i.id, status: 'scheduled', payment_file: fileName })),
    runs: [{ file_name: fileName, pay_date: payDate, invoices: ready.length, total, created_at: now }],
    messages: [
      ...reach(owner, { subject: `Payment file ready for ${fmtDate(payDate)}: ${ready.length} invoices, ${money(total)}`, body: `Kia ora ${firstName(owner.name)},\n\n${text}`, link, related: fileName, workflow: 'Payment file' }, 'email'),
      ...reach(admin, { subject: `Payment file ready for ${fmtDate(payDate)}: ${ready.length} invoices, ${money(total)}`, body: `Kia ora ${firstName(admin.name)},\n\n${text}`, link, related: fileName, workflow: 'Payment file' }, 'email'),
    ],
    audit: [
      ...ready.map((i) => auditRow('Agent', 'agent', 'Payments', i.invoice_id, 'Added to payment file', `${suppliers[i.supplier_id].name}, ${money(i.total)}, approved by ${i.decided_by}. Paid to the account on file.`)),
      auditRow('Agent', 'agent', 'Payments', fileName, 'Prepared the payment file. Nothing was paid', `${ready.length} invoices, ${money(total)}, for ${fmtDate(payDate)}. A person uploads it to the bank.`),
    ],
    fileName,
    summary: `Prepared ${fileName}: ${ready.length} approved invoice${ready.length === 1 ? '' : 's'}, ${money(total)}. Nothing was paid.${later ? ` ${later} approved invoice${later === 1 ? ' is' : 's are'} due later.` : ''}`,
  },
  binary: { data: { data: Buffer.from(csv, 'utf8').toString('base64'), mimeType: 'text/csv', fileName, fileExtension: 'csv' } },
}];
