// GET /webhook/invoices/review?t=INVOICE_TOKEN: one invoice, every check the agent ran, and the decision buttons.
const cfg = configFrom();
const token = String($('Webhook').first().json.query?.t || '');
const inv = tableRows('Invoices').find((i) => token && i.review_token === token);
if (!inv) {
  return [{ json: { html: page('Link not found', `<h1>This link is no longer valid</h1><p class="muted">Ask ${esc(cfg.admin_name)} for a new one.</p>`) } }];
}
return [{ json: { html: page(`Invoice ${inv.supplier_ref}`, reviewBody(inv, cfg)) } }];
