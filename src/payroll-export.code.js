// Payroll export: approved hours for the week → one CSV for payroll and invoicing.
// Returns one item with { updates, messages, exportRecord, fileName } and the CSV as binary "data".
const config = configFrom('Config');
const week = config.week_ending;
const T = Object.fromEntries(tableRows('Temps').map((t) => [t.temp_id, t]));
const C = Object.fromEntries(tableRows('Clients').map((c) => [c.client_id, c]));
const U = Object.fromEntries(tableRows('Umbrellas').map((u) => [u.umbrella_id, u]));
const approved = tableRows('Timesheets').filter((t) => t.week_ending === week && t.status === 'approved')
  .sort((a, b) => a.temp_id.localeCompare(b.temp_id));

if (!approved.length) {
  return [{ json: { updates: [], messages: [], exportRecords: [], fileName: '', summary: 'No newly approved timesheets to export.' } }];
}

const csvCell = (v) => {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const header = ['Timesheet', 'Week ending', 'Worker ID', 'Worker', 'Pay route', 'Paid to', 'Client', 'Hours', 'Pay rate', 'Pay total', 'Charge rate', 'Invoice total (ex VAT)', 'Margin', 'Approved by', 'Approved at'];
let payTotal = 0;
let invoiceTotal = 0;
const lines = approved.map((ts) => {
  const temp = T[ts.temp_id];
  const hours = Number(ts.hours);
  const pay = round2(hours * temp.pay_rate);
  const invoice = round2(hours * temp.charge_rate);
  payTotal += pay;
  invoiceTotal += invoice;
  const umbrella = temp.pay_route === 'PAYE' ? null : U[temp.pay_route];
  return [ts.timesheet_id, ts.week_ending, temp.temp_id, fullName(temp), umbrella ? 'Umbrella' : 'PAYE', umbrella ? umbrella.name : 'Agency payroll',
    C[ts.client_id].name, hours.toFixed(2), temp.pay_rate.toFixed(2), pay.toFixed(2), temp.charge_rate.toFixed(2), invoice.toFixed(2), round2(invoice - pay).toFixed(2),
    ts.approved_by || '', ts.approved_at ? new Date(ts.approved_at).toISOString().slice(0, 16).replace('T', ' ') : ''].map(csvCell).join(',');
});
payTotal = round2(payTotal);
invoiceTotal = round2(invoiceTotal);
lines.push(['TOTAL', '', '', '', '', '', '', approved.reduce((s, t) => s + Number(t.hours), 0).toFixed(2), '', payTotal.toFixed(2), '', invoiceTotal.toFixed(2), round2(invoiceTotal - payTotal).toFixed(2), '', ''].map(csvCell).join(','));
const csv = [header.join(','), ...lines].join('\r\n') + '\r\n';

const stamp = new Date().toISOString().replace(/[-:]/g, '').slice(0, 13);
const fileName = `payroll-we-${week}-${stamp}.csv`;
const now = nowIso();
const updates = approved.map((ts) => ({ id: ts.id, status: 'exported', exported_at: now, export_file: fileName }));
const exportRecords = [{ file_name: fileName, week_ending: week, rows: approved.length, pay_total: payTotal, invoice_total: invoiceTotal, created_at: now }];
const messages = [{
  channel: 'Email', to_name: 'Payroll', to_address: config.payroll_email,
  subject: `Payroll export w/e ${week}: ${approved.length} timesheets, ${money(payTotal)} pay`,
  body: `Attached: ${fileName}. ${approved.length} approved timesheets. Pay ${money(payTotal)}, invoices ${money(invoiceTotal)} ex VAT. Umbrella workers are listed by umbrella company.`,
  link: `${config.base_url}/webhook/payroll/file?name=${encodeURIComponent(fileName)}`, related: fileName, workflow: 'Payroll export',
}];

return [{
  json: { updates, messages, exportRecords, fileName, summary: `Exported ${approved.length} approved timesheets to ${fileName}.` },
  binary: { data: { data: Buffer.from(csv, 'utf8').toString('base64'), mimeType: 'text/csv', fileName, fileExtension: 'csv' } },
}];
