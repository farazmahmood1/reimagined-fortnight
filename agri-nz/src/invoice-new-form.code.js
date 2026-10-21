// GET /webhook/invoices/new: key in an invoice by hand to see the agent check it.
const cfg = configFrom();
return [{ json: { html: page('Add an invoice', newInvoiceBody(cfg), { wide: true, tag: 'Add an invoice' }) } }];
