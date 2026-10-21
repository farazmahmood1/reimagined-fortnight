// Pages for the invoice approval flow. Injected after invoice-rules.js into the nodes that show or change an invoice.
const supplierOf = (inv) => tableRows('Suppliers').find((s) => s.supplier_id === inv.supplier_id) || {};

const checkRows = (checks) => checks.map((c) => `<div class="chk ${c.ok ? 'ok' : c.level === 'high' ? 'high' : 'warn'}"><div class="i">${c.ok ? '✓' : '!'}</div><div><b>${esc(c.label)}</b><span>${esc(c.text)}</span></div></div>`).join('');

// What the agent drafts for the supplier. It is only sent when a person presses the button.
const draftQuery = (inv, sup, approver, cfg) => [
  `Kia ora ${firstName(sup.contact_name) || 'there'},`, '',
  `We have a question about invoice ${inv.supplier_ref} (${fmtDate(inv.invoice_date)}, ${money(inv.total)}) before we can pay it:`, '',
  ...failedChecks(inv).map((c) => `- ${c.ask || c.text}`), '',
  'Could you please check and send a corrected invoice, or let us know if we have this wrong? We will hold payment until then.', '',
  'Thanks,', approver.name, cfg.business_name,
].join('\n');

const reviewBody = (inv, cfg, opts = {}) => {
  const sup = supplierOf(inv);
  const approver = approverFor(inv.approver_role, cfg);
  const checks = parseChecks(inv);
  const failed = checks.filter((c) => !c.ok);
  const pending = ['matched', 'flagged'].includes(inv.status);
  const action = `${cfg.base_url}/webhook/invoices/review`;
  const hidden = `<input type="hidden" name="t" value="${esc(inv.review_token)}">`;
  const form = (decision, inner) => `<form method="post" action="${action}">${hidden}<input type="hidden" name="decision" value="${decision}">${inner}</form>`;
  const back = `<p class="noprint"><a href="${cfg.base_url}/webhook/invoices/queue?t=${esc(approver.token)}">Back to your list</a> &nbsp; <a href="${cfg.base_url}/webhook/invoices/copy?t=${esc(inv.review_token)}" target="_blank">Invoice as received</a></p>`;

  let banner;
  if (!pending) {
    const [tone, label] = INVOICE_STATUS[inv.status] || ['info', inv.status];
    banner = callout(tone === 'grey' ? 'info' : tone, `<b>${esc(label)}.</b>${inv.decided_by ? ` ${esc(inv.decided_by)} decided on ${fmtDate(String(inv.decided_at).slice(0, 10))}.` : ''}${inv.decision_note ? ` Reason: ${esc(inv.decision_note)}` : ''}`);
  } else if (failed.length) {
    banner = callout(failed.some((c) => c.level === 'high') ? 'bad' : 'warn', `<b>${failed.length} of ${checks.length} checks failed.</b> Read the reasons below before you decide. ${money(inv.at_risk)} is at stake.`);
  } else {
    banner = callout('ok', `<b>All ${checks.length} checks passed.</b> It still needs your yes: the agent cannot approve or pay anything.`);
  }

  const queryForm = form('query', `<h3>Ask the supplier</h3><p class="muted">The agent drafted this from the failed checks. Edit it if you like. It is only sent when you press the button.</p>
<textarea name="query_text" style="min-height:230px" required>${esc(opts.query_text || draftQuery(inv, sup, approver, cfg))}</textarea>
<button class="btn" type="submit">Send this to ${esc(sup.contact_name || 'the supplier')}</button>`);
  const anywayForm = form('approve_anyway', `<h3>Approve anyway</h3><p class="muted">Only if you are sure it is safe to pay. Your reason goes into the record. Payment always goes to the bank account on file.</p>
<textarea name="note" placeholder="Why is it safe to pay?" required>${esc(opts.note || '')}</textarea>
<button class="btn go" type="submit">Approve ${money(inv.total)} anyway</button>`);
  const rejectForm = form('reject', `<h3>Reject this invoice</h3><textarea name="note" placeholder="Reason (optional)"></textarea>
<button class="btn stop" type="submit">Reject</button>`);
  const decide = !pending ? '' : failed.length
    ? `<div class="stack noprint">${queryForm}${anywayForm}${rejectForm}</div>`
    : `<div class="stack noprint">${form('approve', `<button class="btn go" type="submit">Approve ${money(inv.total)}</button>`)}<details style="margin-top:14px"><summary class="muted" style="cursor:pointer">Other options</summary>${queryForm}${rejectForm}</details></div>`;

  return `<h1>${esc(sup.name)}</h1>
<p class="muted">Invoice ${esc(inv.supplier_ref)} for ${money(inv.total)}. ${esc(approver.name)} (${esc(approver.title)}) decides.</p>
${opts.error ? callout('bad', esc(opts.error)) : ''}${banner}
<table class="kv">
<tr><td>For</td><td>${esc(inv.description)}</td></tr>
<tr><td>Price</td><td>${qtyText(inv.qty)} ${esc(unitText(inv.qty, inv.unit))} at ${priceText(inv.unit_price)}</td></tr>
<tr><td>Total</td><td><b>${money(inv.total)}</b> including GST of ${money(inv.gst)}</td></tr>
<tr><td>Invoice date</td><td>${fmtDate(inv.invoice_date)}</td></tr>
<tr><td>Due</td><td>${fmtDate(inv.due_date)}, the 20th of the month following</td></tr>
</table>
<h2>What the agent checked</h2>${checkRows(checks)}
${decide}${back}`;
};

// The form for keying in an invoice by hand. In production, invoices are read from the farm's invoice inbox instead.
const PRESETS = {
  normal: { label: 'A normal invoice', supplier_id: 'S01', item: 'Urea (46% N)', qty: 20, unit: 't', unit_price: 890, docket_ref: 'DK-20400', prefix: 'AF' },
  price: { label: 'Price 10% over the contract', supplier_id: 'S02', item: 'PKE', qty: 25, unit: 't', unit_price: 435, docket_ref: 'DK-51260', prefix: 'FS' },
  bank: { label: 'Bank account changed', supplier_id: 'S03', item: 'Diesel', qty: 3000, unit: 'L', unit_price: 1.78, docket_ref: 'DK-90301', bank_account: '12-3401-0987650-00', prefix: 'IFS' },
  gst: { label: 'GST charged wrongly', supplier_id: 'S04', item: 'Vet consult', qty: 4, unit: 'h', unit_price: 168, gst: 80, prefix: 'RRV' },
  volume: { label: 'More than the contract volume', supplier_id: 'S06', item: 'Baleage wrapping', qty: 500, unit: 'bale', unit_price: 24.5, prefix: 'WC' },
  nocontract: { label: 'Not on any contract', supplier_id: 'S07', item: 'Italian ryegrass seed', qty: 250, unit: 'kg', unit_price: 9.8, prefix: 'SSG' },
  duplicate: { label: 'Same invoice number again', supplier_id: 'S05', item: 'Stock cartage', qty: 3, unit: 'load', unit_price: 540, ref: 'MSC-0931' },
};
const newInvoiceBody = (cfg, v = {}, error = '') => {
  const suppliers = tableRows('Suppliers');
  const items = [...new Set(tableRows('Contracts').map((c) => c.item))];
  const val = (k, d = '') => esc(v[k] ?? d);
  return `<h1>Add an invoice</h1>
<p>Key in a supplier invoice to see the agent check it. In your business, invoices are read from your invoice inbox, so nobody types them. Try an example:</p>
<p class="noprint">${Object.entries(PRESETS).map(([k, p]) => `<button type="button" class="btn line inline" style="margin:4px 4px 0 0;min-height:36px;padding:6px 12px;font-size:13px" data-preset="${k}">${esc(p.label)}</button>`).join('')}</p>
${error ? callout('bad', esc(error)) : ''}
<form id="f" method="post" action="${cfg.base_url}/webhook/invoices/new">
<label for="supplier_id">Supplier</label><select id="supplier_id" name="supplier_id" required>${suppliers.map((s) => `<option value="${esc(s.supplier_id)}"${v.supplier_id === s.supplier_id ? ' selected' : ''}>${esc(s.name)}</option>`).join('')}</select>
<label for="item">Item</label><input id="item" name="item" list="items" value="${val('item')}" required><datalist id="items">${items.map((i) => `<option value="${esc(i)}">`).join('')}</datalist>
<label for="ref">Supplier's invoice number</label><input id="ref" name="ref" value="${val('ref')}" required>
<label for="invoice_date">Invoice date</label><input id="invoice_date" name="invoice_date" type="date" value="${val('invoice_date', nzToday())}" required>
<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px">
<div><label for="qty">Quantity</label><input id="qty" name="qty" type="number" step="any" min="0" value="${val('qty')}" required></div>
<div><label for="unit">Unit</label><input id="unit" name="unit" value="${val('unit')}" required></div>
<div><label for="unit_price">Price per unit</label><input id="unit_price" name="unit_price" type="number" step="any" min="0" value="${val('unit_price')}" required></div></div>
<label for="gst">GST on the invoice (leave blank for 15%)</label><input id="gst" name="gst" type="number" step="any" min="0" value="${val('gst')}">
<label for="bank_account">Bank account on the invoice (blank if none)</label><input id="bank_account" name="bank_account" value="${val('bank_account')}">
<label for="docket_ref">Delivery docket number (blank for services)</label><input id="docket_ref" name="docket_ref" value="${val('docket_ref')}">
<button class="btn" type="submit">Add invoice</button> <a class="btn line" href="${cfg.base_url}/webhook/console?tab=invoices">Cancel</a>
</form>
<script>
var P=${JSON.stringify(PRESETS).replace(/</g, '\\u003c')};
document.querySelectorAll('[data-preset]').forEach(function(b){b.addEventListener('click',function(){
  var p=P[b.dataset.preset],f=document.getElementById('f');
  ['supplier_id','item','qty','unit','unit_price','docket_ref','gst','bank_account'].forEach(function(k){f.elements[k].value=p[k]===undefined?'':p[k];});
  f.elements.ref.value=p.ref||(p.prefix+'-'+Math.floor(1000+Math.random()*9000));
});});
</script>`;
};
