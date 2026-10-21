// The rules the agent applies to every supplier invoice. Injected into the nodes that check or show invoices.
// The agent only checks and flags. Approving and paying are always a person's decision.
const norm = (s) => String(s ?? '').trim().toLowerCase();
const digitsOf = (s) => String(s ?? '').replace(/\D/g, '');

// The next payment date on or after `today`: the payDay-th of this month, or of next month once it has passed.
const nextPayDate = (today, payDay) => {
  const d = dateOf(today);
  const month = d.getUTCDate() > payDay ? d.getUTCMonth() + 1 : d.getUTCMonth();
  return isoDay(new Date(Date.UTC(d.getUTCFullYear(), month, payDay)));
};
// Standard rural terms: the 20th of the month following the invoice date.
const dueDateFor = (invoiceDate, payDay) => {
  const d = dateOf(invoiceDate);
  return isoDay(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, payDay)));
};
const parseChecks = (inv) => { try { return JSON.parse(inv.reasons || '[]'); } catch { return []; } };
const failedChecks = (inv) => parseChecks(inv).filter((c) => !c.ok);

const approverFor = (role, cfg) => (role === 'owner'
  ? { role, title: 'owner', name: cfg.owner_name, email: cfg.owner_email, phone: cfg.owner_phone, token: cfg.approver_token_owner }
  : { role, title: 'operations manager', name: cfg.manager_name, email: cfg.manager_email, phone: cfg.manager_phone, token: cfg.approver_token_manager });

// status → [tone, label]
const INVOICE_STATUS = {
  received: ['grey', 'New, not checked yet'],
  matched: ['info', 'Clean, waiting for approval'],
  flagged: ['warn', 'Flagged, waiting for a decision'],
  approved: ['ok', 'Approved'],
  queried: ['warn', 'Queried with supplier'],
  rejected: ['bad', 'Rejected'],
  scheduled: ['ok', 'In payment file'],
  paid: ['grey', 'Paid'],
};
const invoiceStatusPill = (inv) => { const [tone, label] = INVOICE_STATUS[inv.status] || ['grey', inv.status]; return pill(tone, label); };

// Runs every check on one invoice. ctx = { cfg, suppliers (by id), contracts, dockets, invoices (all), used (contract_id → qty used) }.
// Each check has `text` (for the farm) and, when it fails, `ask` (a sentence that is safe to send to the supplier).
const checkInvoice = (inv, ctx) => {
  const cfg = ctx.cfg;
  const gst = Number(cfg.gst_rate || 0.15);
  const sup = ctx.suppliers[inv.supplier_id];
  const supName = sup ? sup.name : 'this supplier';
  const qty = Number(inv.qty);
  const price = Number(inv.unit_price);
  const total = Number(inv.total);
  const checks = [];
  const add = (id, label, ok, text, extra = {}) => checks.push({ id, label, ok, text, short: ok ? '' : (extra.short || label), ask: ok ? '' : (extra.ask || ''), level: ok ? 'ok' : (extra.level || 'warn'), risk: ok ? 0 : round2(extra.risk || 0) });
  // Only an earlier invoice can make this one a duplicate.
  const earlier = (o) => o.received_at < inv.received_at || (o.received_at === inv.received_at && o.invoice_id < inv.invoice_id);

  // 1. Is there a contract in force for this item?
  const sameItem = ctx.contracts.filter((c) => c.supplier_id === inv.supplier_id && norm(c.item) === norm(inv.item));
  const contract = sameItem.find((c) => inv.invoice_date >= c.valid_from && inv.invoice_date <= c.valid_to);
  if (contract) add('contract', 'Matches a contract', true, `${contract.contract_id}: ${contract.description}.`);
  else if (sameItem.length) add('contract', 'Matches a contract', false, `The ${inv.item} contract with ${supName} was not in force on ${fmtDate(inv.invoice_date)} (it runs ${fmtDate(sameItem[0].valid_from)} to ${fmtDate(sameItem[0].valid_to)}).`,
    { short: 'Contract not in force on the invoice date', ask: `We could not match this invoice to an agreement in force on ${fmtDate(inv.invoice_date)}. Could you send us the agreement it is based on?` });
  else add('contract', 'Matches a contract', false, `No contract or agreed price covers ${inv.item} from ${supName}. Find the agreement, or confirm this is a one-off purchase.`,
    { short: 'No contract covers this item', ask: `We could not match "${inv.item}" to an agreed price on our side. Could you send us the quote or agreement it is based on?` });

  if (contract) {
    // 2. Unit price against the contract, with a small tolerance.
    const agreed = Number(contract.agreed_price);
    const tol = Number(contract.tolerance_pct ?? cfg.price_tolerance_pct ?? 2);
    const diffPct = ((price - agreed) / agreed) * 100;
    if (norm(inv.unit) !== norm(contract.unit)) {
      add('price', 'Price matches the contract', false, `Invoiced per ${inv.unit}, but the contract price is per ${contract.unit}.`,
        { short: 'Priced per a different unit from the contract', ask: `The invoice is priced per ${inv.unit}, but our agreement is per ${contract.unit}. Please check and confirm the price.` });
    } else if (diffPct > tol) {
      const over = round2((price - agreed) * qty);
      add('price', 'Price matches the contract', false, `Unit price ${priceText(price)} is ${diffPct.toFixed(1)}% above the contract price of ${priceText(agreed)} per ${contract.unit}: ${money(over)} too much on ${qtyText(qty)} ${inv.unit} (ex GST).`,
        { short: `Price ${diffPct.toFixed(1)}% over the contract`, risk: over * (1 + gst), ask: `The unit price of ${priceText(price)} per ${contract.unit} is above the agreed ${priceText(agreed)} per ${contract.unit} (${money(over)} more, ex GST). Please check it, or send us the agreement that supports the higher price.` });
    } else if (diffPct > 0.0001) {
      add('price', 'Price matches the contract', true, `${priceText(price)} per ${contract.unit} is ${diffPct.toFixed(1)}% above the contract price, within the ${tol}% tolerance.`);
    } else {
      add('price', 'Price matches the contract', true, `${priceText(price)} per ${contract.unit}${diffPct < -0.0001 ? ' (below' : ' (matches'} the contract price of ${priceText(agreed)}).`);
    }

    // 3. How much of the contract volume is used up?
    const used = ctx.used[contract.contract_id] || 0;
    const agreedQty = Number(contract.qty_agreed);
    if (qty > agreedQty - used + 0.0001) {
      const overQty = round2(used + qty - agreedQty);
      add('volume', 'Within the contract volume', false, `This invoice takes ${contract.item} to ${qtyText(used + qty)} of ${qtyText(agreedQty)} ${contract.unit} agreed (${qtyText(overQty)} ${contract.unit} over). Confirm the price for the extra volume.`,
        { short: `${qtyText(overQty)} ${contract.unit} over the contract volume`, risk: overQty * price * (1 + gst), ask: `This invoice takes our total to ${qtyText(used + qty)} ${contract.unit}, which is above the ${qtyText(agreedQty)} ${contract.unit} we agreed. Please confirm the price that applies to the extra ${qtyText(overQty)} ${contract.unit}.` });
    } else {
      add('volume', 'Within the contract volume', true, `${qtyText(used + qty)} of ${qtyText(agreedQty)} ${contract.unit} used after this invoice.`);
    }
  }

  // 4. Delivery docket: was the delivery signed for, does the quantity match, and was the docket already invoiced?
  const needsDocket = contract ? contract.needs_docket === 'yes' : !!inv.docket_ref;
  if (inv.docket_ref) {
    const docket = ctx.dockets.find((d) => norm(d.docket_ref) === norm(inv.docket_ref) && d.supplier_id === inv.supplier_id);
    const reused = ctx.invoices.find((o) => o.invoice_id !== inv.invoice_id && norm(o.docket_ref) === norm(inv.docket_ref) && o.status !== 'rejected' && earlier(o));
    if (!docket) {
      add('docket', 'Matches a delivery docket', false, `Docket ${inv.docket_ref} is not in the delivery records. Was this delivery signed for?`,
        { short: 'Docket not in the delivery records', ask: `We cannot find delivery docket ${inv.docket_ref} in our records. Could you send us a copy of the signed docket?` });
    } else if (qty > Number(docket.qty) + 0.0001) {
      const short = round2(qty - Number(docket.qty));
      add('docket', 'Matches a delivery docket', false, `Invoiced ${qtyText(qty)} ${inv.unit}, but docket ${docket.docket_ref} shows ${qtyText(docket.qty)} ${docket.unit} delivered on ${fmtDate(docket.delivered_on)}: ${qtyText(short)} ${inv.unit} not delivered (${money(short * price)} ex GST).`,
        { short: `Docket shows ${qtyText(docket.qty)} ${docket.unit}, invoiced ${qtyText(qty)}`, risk: short * price * (1 + gst), ask: `You invoiced ${qtyText(qty)} ${inv.unit}, but our signed docket ${docket.docket_ref} shows ${qtyText(docket.qty)} ${docket.unit} delivered on ${fmtDate(docket.delivered_on)}. Please check and send a corrected invoice.` });
    } else if (reused) {
      add('docket', 'Matches a delivery docket', false, `Docket ${docket.docket_ref} was already invoiced on ${reused.invoice_id} (${reused.supplier_ref}, ${money(reused.total)}). One delivery should be invoiced once.`,
        { short: 'Docket already invoiced', risk: total, ask: `Delivery docket ${docket.docket_ref} has already been invoiced on ${reused.supplier_ref}. Please confirm this invoice is not a repeat.` });
    } else {
      add('docket', 'Matches a delivery docket', true, `Docket ${docket.docket_ref}: ${qtyText(docket.qty)} ${docket.unit} delivered ${fmtDate(docket.delivered_on)}, signed by ${docket.received_by}.`);
    }
  } else if (needsDocket) {
    add('docket', 'Matches a delivery docket', false, 'No delivery docket reference on this invoice. Check the delivery was received before paying.',
      { short: 'No delivery docket number', ask: 'There is no delivery docket number on this invoice. Please send the docket number or a copy of the signed docket.' });
  } else {
    add('docket', 'Matches a delivery docket', true, 'A service invoice: no delivery docket needed.');
  }

  // 5. Arithmetic and GST.
  const net = round2(qty * price);
  const gstExpected = round2(net * gst);
  const problems = [];
  let gstRisk = 0;
  if (Math.abs(Number(inv.net) - net) > 0.02) { problems.push(`Net ${money(inv.net)} is not ${qtyText(qty)} × ${priceText(price)} = ${money(net)}.`); gstRisk = Math.max(gstRisk, Math.abs(Number(inv.net) - net)); }
  if (Math.abs(Number(inv.gst) - gstExpected) > 0.02) { problems.push(`GST is ${money(inv.gst)}, but ${Math.round(gst * 100)}% of ${money(net)} is ${money(gstExpected)}.`); gstRisk = Math.max(gstRisk, Math.abs(Number(inv.gst) - gstExpected)); }
  if (Math.abs(total - (Number(inv.net) + Number(inv.gst))) > 0.02) { problems.push(`The total ${money(total)} is not net plus GST (${money(Number(inv.net) + Number(inv.gst))}).`); gstRisk = Math.max(gstRisk, Math.abs(total - (Number(inv.net) + Number(inv.gst)))); }
  if (problems.length) add('gst', 'Arithmetic and GST add up', false, problems.join(' '), { short: 'GST or total does not add up', risk: gstRisk, ask: `The amounts on this invoice do not add up: ${problems.join(' ')} Please send a corrected invoice.` });
  else add('gst', 'Arithmetic and GST add up', true, `${money(net)} plus GST ${money(inv.gst)} makes ${money(total)}.`);

  // 6. Has this invoice been seen before?
  const dup = ctx.invoices.find((o) => o.invoice_id !== inv.invoice_id && o.supplier_id === inv.supplier_id && o.status !== 'rejected' && earlier(o)
    && ((norm(o.supplier_ref) && norm(o.supplier_ref) === norm(inv.supplier_ref)) || (round2(o.total) === round2(total) && o.invoice_date === inv.invoice_date)));
  if (dup) add('duplicate', 'Not a duplicate', false, `Supplier invoice number ${inv.supplier_ref} was already received as ${dup.invoice_id} (${(INVOICE_STATUS[dup.status] || ['', dup.status])[1].toLowerCase()}, dated ${fmtDate(dup.invoice_date)}, ${money(dup.total)}).`,
    { short: 'Looks like a duplicate', risk: total, ask: `Invoice ${inv.supplier_ref} looks like one we have already received (${money(dup.total)}, dated ${fmtDate(dup.invoice_date)}). Please confirm it is not a duplicate.` });
  else add('duplicate', 'Not a duplicate', true, 'Not seen before from this supplier.');

  // 7. Bank account against the supplier record. Payments always go to the account on file.
  const invBank = digitsOf(inv.bank_account);
  const fileBank = digitsOf(sup && sup.bank_account);
  if (invBank && fileBank && invBank !== fileBank) {
    add('bank', 'Bank account matches the one on file', false, `The invoice shows ${inv.bank_account}, but the account on file is ${sup.bank_account}. Phone the supplier on a number you already have before paying anything. Payments always go to the account on file.`,
      { short: 'Bank account is not the one on file', level: 'high', risk: total, ask: `The bank account on this invoice (${inv.bank_account}) is different from the one we hold on file. Please phone us to confirm any change of bank details. We will not pay to a different account until we have spoken.` });
  } else {
    add('bank', 'Bank account matches the one on file', true, invBank ? 'Same account as on file.' : 'No account on the invoice; payment goes to the account on file.');
  }

  const failed = checks.filter((c) => !c.ok);
  const result = failed.length ? 'Review' : 'Clean';
  return {
    contract, checks, result,
    at_risk: failed.reduce((m, c) => Math.max(m, c.risk), 0),
    due_date: dueDateFor(inv.invoice_date, Number(cfg.pay_day || 20)),
    approver_role: failed.length || total > Number(cfg.manager_limit || 2500) ? 'owner' : 'manager',
    summary: failed.map((c) => c.text).join(' '),
  };
};
