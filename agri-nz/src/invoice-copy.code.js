// GET /webhook/invoices/copy?t=INVOICE_TOKEN: the invoice as received, laid out like a supplier tax invoice.
const cfg = configFrom();
const token = String($('Webhook').first().json.query?.t || '');
const inv = tableRows('Invoices').find((i) => token && i.review_token === token);
if (!inv) return [{ json: { html: page('Link not found', '<h1>This link is no longer valid</h1>') } }];
const sup = supplierOf(inv);
const body = `<h1>Tax invoice</h1>
<p class="muted">As received from ${esc(sup.name)}. This is a demo rendering of the invoice record.</p>
<table class="kv">
<tr><td>From</td><td><b>${esc(sup.name)}</b></td></tr>
<tr><td>To</td><td>${esc(cfg.business_name)}</td></tr>
<tr><td>Invoice number</td><td>${esc(inv.supplier_ref)}</td></tr>
<tr><td>Invoice date</td><td>${fmtDate(inv.invoice_date)}</td></tr>
<tr><td>Delivery docket</td><td>${esc(inv.docket_ref || 'None')}</td></tr>
<tr><td>Pay to</td><td>${esc(inv.bank_account || 'No account shown')}</td></tr>
</table>
<table class="list"><tr><th>Description</th><th class="num">Quantity</th><th class="num">Price</th><th class="num">Amount</th></tr>
<tr><td>${esc(inv.item)}</td><td class="num">${qtyText(inv.qty)} ${esc(unitText(inv.qty, inv.unit))}</td><td class="num">${priceText(inv.unit_price)}</td><td class="num">${money(inv.net)}</td></tr>
<tr><td colspan="3" class="num">GST</td><td class="num">${money(inv.gst)}</td></tr>
<tr><td colspan="3" class="num"><b>Total</b></td><td class="num"><b>${money(inv.total)}</b></td></tr></table>
<p class="muted">Received ${fmtTime(inv.received_at)} by email.</p>`;
return [{ json: { html: page(`Invoice ${inv.supplier_ref}`, body, { wide: true, tag: 'Invoice as received' }) } }];
