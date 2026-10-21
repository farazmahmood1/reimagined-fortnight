// Builds the Monday-morning starting point for the demo. DEMO_DATA is injected by the build script from scripts/demo-data.mjs.
// Every date is worked out from today in New Zealand time, so each reset tells the same story whenever you record it:
// nine invoices to check (four hide a problem), farm plan evidence partly collected, and consents running out.
// Returns one item with an array of rows per data table.
const D = DEMO_DATA;
const today = nzToday();
const now = Date.now();
const HOUR = 3600000;
const iso = (ms) => new Date(ms).toISOString();
const cfgObj = Object.fromEntries(D.CONFIG.map((c) => [c.key, c.value]));
const payDay = Number(cfgObj.pay_day);
const payDate = nextPayDate(today, payDay);
// Seeded invoices are dated in the month before the pay date, so every one of them is due on the pay date.
const pd = dateOf(payDate);
const invMonth = new Date(Date.UTC(pd.getUTCFullYear(), pd.getUTCMonth() - 1, 1));
const histMonth = new Date(Date.UTC(pd.getUTCFullYear(), pd.getUTCMonth() - 2, 1));
const dayIn = (monthStart, day) => isoDay(new Date(Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth(), day)));
const audit = [];
const log = (at, actor, type, flow, subject, action, detail) => audit.push({ at: iso(at), actor, actor_type: type, flow, subject, action, detail: detail || '' });

const config = [...D.CONFIG,
  { key: 'approver_token_owner', value: newToken() },
  { key: 'approver_token_manager', value: newToken() },
  { key: 'demo_reset_on', value: today }];
const sup = Object.fromEntries(D.SUPPLIERS.map((s) => [s.supplier_id, s]));

// ---- suppliers, contracts, delivery dockets
const contracts = D.CONTRACTS.map((c) => ({ ...c, valid_from: addDays(today, -150), valid_to: addDays(today, 215), tolerance_pct: 2 }));
const invoiceDateOf = (key) => {
  const spec = [...D.INVOICES, ...D.HISTORY].find((i) => i.key === key);
  return dayIn(key.startsWith('H') ? histMonth : invMonth, spec.day);
};
const dockets = D.DOCKETS.map((d) => ({
  docket_ref: d.docket_ref, supplier_id: d.supplier_id, item: d.item, qty: d.qty, unit: d.unit,
  delivered_on: d.invoice ? addDays(invoiceDateOf(d.invoice), -2) : addDays(today, -d.days_ago), received_by: d.received_by,
}));

// ---- invoices: this week's (not yet checked) and the paid history
const year = today.slice(0, 4);
let seq = 1000;
const invoice = (spec, month, extra) => {
  const net = round2(spec.qty * spec.price);
  const gst = round2(net * 0.15);
  const invoice_date = dayIn(month, spec.day);
  return {
    invoice_id: `INV-${year}-${++seq}`, supplier_id: spec.supplier_id, supplier_ref: spec.ref, invoice_date, due_date: dueDateFor(invoice_date, payDay),
    item: spec.item, description: `${spec.item}, ${qtyText(spec.qty)} ${unitText(spec.qty, spec.unit)}`, qty: spec.qty, unit: spec.unit, unit_price: spec.price,
    net, gst, total: round2(net + gst), bank_account: spec.bank || sup[spec.supplier_id].bank_account, docket_ref: spec.docket || '',
    source: '', received_at: '', status: 'received', contract_id: '', result: '', reasons: '', at_risk: 0, checked_at: '', approver_role: '', approver_name: '',
    review_token: '', approval_requested_at: '', decision: '', decided_at: '', decided_by: '', decision_note: '', payment_file: '', ...extra,
  };
};
const invoices = [];
D.HISTORY.forEach((h) => {
  const decided = Date.parse(`${dayIn(histMonth, h.day)}T10:00:00Z`) + 3 * 86400000;
  const inv = invoice(h, histMonth, {
    source: 'Email: invoices@tussockridge.example', received_at: iso(Date.parse(`${dayIn(histMonth, h.day)}T09:00:00Z`)), status: 'paid', contract_id: h.contract_id, result: 'Clean', reasons: '[]',
    checked_at: iso(decided - 86400000), approver_role: 'owner', approver_name: cfgObj.owner_name, decision: 'approved', decided_at: iso(decided), decided_by: cfgObj.owner_name, payment_file: 'payment-run-earlier.csv',
  });
  invoices.push(inv);
  log(decided - 86400000, 'Agent', 'agent', 'Invoices', inv.invoice_id, 'Matched to contract', `${h.contract_id}: all checks passed.`);
  log(decided, cfgObj.owner_name, 'person', 'Invoices', inv.invoice_id, 'Approved', `${sup[h.supplier_id].name} ${h.ref}, ${money(inv.total)}.`);
  log(decided + 86400000, 'Agent', 'agent', 'Payments', inv.invoice_id, 'Added to payment file', 'payment-run-earlier.csv');
});
D.INVOICES.forEach((spec, i) => {
  invoices.push(invoice(spec, invMonth, { source: 'Email: invoices@tussockridge.example', received_at: iso(now - (D.INVOICES.length - i) * 7 * 60000) }));
});
// ---- farms, the checklist and the evidence
const farms = D.FARMS.map((f) => ({
  farm_id: f.farm_id, name: f.name, farm_type: f.farm_type, location: f.location, region: cfgObj.region, area_ha: f.area_ha,
  manager_name: f.manager_name, manager_email: f.manager_email, manager_phone: f.manager_phone,
  pack_status: 'Collecting', pack_token: newToken(), signoff_token: newToken(), ready_at: '', signed_by: '', signed_at: '', sent_at: '', sent_to: '',
}));
const requirements = D.REQUIREMENTS.map((r) => {
  const p = D.PROVIDERS[r.provider];
  return { req_id: r.req_id, requirement: r.requirement, category: r.category, applies_to: r.applies_to, provider_name: p ? p.name : '', provider_email: p ? p.email : '', provider_phone: p ? p.phone : '' };
});
const evidence = [];
D.FARMS.forEach((fd, fi) => {
  const farm = farms[fi];
  D.REQUIREMENTS.filter((r) => r.applies_to === 'All' || r.applies_to === fd.farm_type).forEach((req, n) => {
    const start = (D.EVIDENCE_START[fd.farm_id] || {})[req.req_id];
    const s = typeof start === 'string' ? { s: start } : start || { s: 'verified' };
    const p = D.PROVIDERS[req.provider] || { name: farm.manager_name, email: farm.manager_email, phone: farm.manager_phone };
    const hasFile = s.s === 'received' || s.s === 'verified';
    const verified = s.s === 'verified';
    const received = hasFile ? iso(s.s === 'received' ? now - 3 * HOUR : now - (24 + n) * 86400000) : '';
    const item = {
      item_id: `E-${farm.farm_id}-${req.req_id}`, farm_id: farm.farm_id, req_id: req.req_id, requirement: req.requirement, category: req.category,
      provider_name: p.name, provider_email: p.email, provider_phone: p.phone, status: s.s, upload_token: newToken(),
      file_name: hasFile ? 'seed-sample-evidence.pdf' : '', original_name: hasFile ? `${fd.slug}-${req.short}.pdf` : '', received_at: received,
      verified_at: verified ? iso(now - (12 + n) * 86400000) : '', verified_by: verified ? farm.manager_name : '',
      requests_sent: s.s === 'missing' ? 0 : (s.sent ?? 1), last_request_at: s.s === 'requested' ? iso(now - s.ago * 86400000) : hasFile ? iso(now - (30 + n) * 86400000) : '', note: '',
    };
    evidence.push(item);
    if (verified) log(now - (12 + n) * 86400000, farm.manager_name, 'person', 'Farm plan', farm.name, `Verified: ${req.requirement}`, `Checked against ${item.original_name}.`);
  });
});

// ---- consents, certificates and other records with an expiry date
const register = D.REGISTER.map((g) => {
  const who = g.who === 'owner' ? { name: cfgObj.owner_name, email: cfgObj.owner_email, phone: cfgObj.owner_phone } : { name: g.who, ...D.STAFF[g.who] };
  const verified = g.days !== null;
  return {
    reg_id: g.reg_id, farm_id: g.farm_id, kind: g.kind, type: g.type, reference: g.reference, holder: g.kind === 'Consent' ? cfgObj.business_name : who.name,
    responsible_name: who.name, responsible_email: who.email, responsible_phone: who.phone, restriction: g.restriction,
    expiry_date: verified ? addDays(today, g.days) : '', status: verified ? 'verified' : 'missing', new_expiry: '', upload_token: newToken(),
    file_name: verified ? 'seed-sample-certificate.pdf' : '', original_name: verified ? `${g.type.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.pdf` : '',
    received_at: verified ? iso(now - 90 * 86400000) : '', verified_at: verified ? iso(now - 88 * 86400000) : '', verified_by: verified ? cfgObj.admin_name : '',
    reminders_sent: 0, last_reminder_at: '', renewal_lodged_at: '', last_state: '', note: '',
  };
});

log(now, 'System', 'system', 'Demo', 'Demo data', 'Reset', 'Monday-morning demo data loaded.');
const toCheck = invoices.filter((i) => i.status === 'received').length;
return [{ json: {
  Config: config, Suppliers: D.SUPPLIERS, Contracts: contracts, Dockets: dockets, Invoices: invoices, Farms: farms, Requirements: requirements,
  Evidence: evidence, Register: register, 'Audit log': audit,
  summary: `Demo data reset: ${toCheck} new invoices to check, next pay date ${fmtDate(payDate)}.`,
} }];
