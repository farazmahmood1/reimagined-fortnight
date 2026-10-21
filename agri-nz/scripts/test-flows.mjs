// End-to-end test of all three automations through their real webhooks (n8n must be running).
// Run: npm run test-flows     It resets the demo data before and after.
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, BASE_URL } from './env.mjs';

let failures = 0;
const ok = (cond, label, extra = '') => {
  console.log(`${cond ? '  ✓' : '  ✗'} ${label}${!cond && extra ? `\n      → ${String(extra).slice(0, 400)}` : ''}`);
  if (!cond) failures++;
};
const step = (t) => console.log(`\n${t}`);
const decode = (s) => String(s).replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
const count = (s, needle) => s.split(needle).length - 1;
const money = (n) => new Intl.NumberFormat('en-NZ', { style: 'currency', currency: 'NZD' }).format(n);
const nzToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Pacific/Auckland', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const fmtDate = (s) => new Date(`${s}T00:00:00Z`).toLocaleDateString('en-NZ', { timeZone: 'UTC', day: 'numeric', month: 'short', year: 'numeric' });
const addDays = (s, n) => new Date(new Date(`${s}T00:00:00Z`).getTime() + n * 86400000).toISOString().slice(0, 10);

const FORM = { 'content-type': 'application/x-www-form-urlencoded' };
async function run(action) {
  const res = await fetch(`${BASE_URL}/webhook/console/run`, { method: 'POST', redirect: 'manual', headers: FORM, body: `run=${action}` });
  const loc = decodeURIComponent(res.headers.get('location') || '');
  return { status: res.status, notice: loc.split('done=')[1] || '' };
}
const get = async (url) => { if (!url) return { status: 0, text: '(no link found)', type: '', headers: new Headers() }; const r = await fetch(url); return { status: r.status, text: await r.text(), type: r.headers.get('content-type') || '', headers: r.headers }; };
const consoleTab = async (tab, extra = '') => (await get(`${BASE_URL}/webhook/console?tab=${tab}${extra}`)).text;
const post = async (route, fields) => {
  const res = await fetch(`${BASE_URL}/webhook/${route}`, { method: 'POST', redirect: 'manual', headers: FORM, body: new URLSearchParams(fields) });
  const loc = decodeURIComponent(res.headers.get('location') || '');
  return { status: res.status, text: res.status === 200 ? await res.text() : '', notice: loc.split('done=')[1] || '' };
};
const upload = async (route, token, extra, file, mime = 'application/pdf', name = path.basename(file)) => {
  const fd = new FormData();
  fd.set('t', token);
  for (const [k, v] of Object.entries(extra)) fd.set(k, v);
  fd.set('file', new Blob([fs.readFileSync(file)], { type: mime }), name);
  const res = await fetch(`${BASE_URL}/webhook/${route}`, { method: 'POST', body: fd });
  return { status: res.status, text: await res.text() };
};
const rowFor = (html, text) => html.split('<tr').find((r) => r.includes(text)) || '';
const rowWith = (html, ...texts) => html.split('<tr').find((r) => texts.every((t) => r.includes(t))) || '';
const linkIn = (part, pathPart) => { const m = part.match(new RegExp(`href="(${BASE_URL}/webhook/${pathPart}[^"]*)"`)); return m ? decode(m[1]) : ''; };
const farmBlock = (html, name) => html.split('<div class="farm">').find((b) => b.includes(`<h3>${name}</h3>`)) || '';
const token = (url) => new URL(url).searchParams.get('t');
const demo = (f) => path.join(ROOT, 'demo-files', f);
const outboxOf = async () => { const h = await consoleTab('log'); return h.slice(h.indexOf('>Messages<')); };
const auditOf = async (extra = '') => { const h = await consoleTab('log', extra); return h.slice(h.indexOf('>Audit trail<'), h.indexOf('>Messages<')); };

// ------------------------------------------------------------------ 0. reset
step('0 · Reset demo data');
let r = await run('reset');
ok(r.status === 303 && /Reset: Demo data reset: 9 new invoices to check/.test(r.notice), 'Reset returns to the console', `${r.status} ${r.notice}`);
let html = await consoleTab('gate');
ok(html.includes('Tussock Ridge Farming Ltd') && html.includes('Farm admin agent'), 'Console renders');
ok(/<span class="n">6<\/span>/.test(html), 'Monday morning: 6 things waiting for a person (2 uploads to check, 4 records needing action)', (html.match(/<span class="n">(\d+)/) || [])[0]);
ok(/Done by the agent alone/.test(html) && /Every step logged/.test(html) && /Waiting for a person's yes/.test(html), 'The three-zone strip is there');
for (const tab of ['invoices', 'plan', 'consents', 'log']) {
  const res = await get(`${BASE_URL}/webhook/console?tab=${tab}`);
  ok(res.status === 200 && res.text.includes('Tussock Ridge'), `Tab "${tab}" renders`);
}
html = await consoleTab('invoices');
ok(count(html, 'Not checked yet') === 9, '9 invoices are not checked yet', `found ${count(html, 'Not checked yet')}`);

// ------------------------------------------------------------------ 1. invoices
step('1 · Invoices: the agent checks, a person decides');
r = await run('check');
ok(r.notice === 'Check new invoices: Checked 9 invoices: 5 clean, 4 flagged for review. Nothing is approved or paid until a person decides.', 'Check summary', r.notice);
html = await consoleTab('invoices');
ok(count(html, '>Flagged, waiting for a decision<') === 4 && count(html, '>Clean, waiting for approval<') === 5, '4 flagged and 5 clean invoices waiting', `${count(html, '>Flagged, waiting')} / ${count(html, '>Clean, waiting')}`);
ok(html.includes('$17,212.63'), 'Held back for review: $17,212.63');
r = await run('check');
ok(r.notice.includes('No new invoices to check'), 'A second check finds nothing new', r.notice);

let out = await outboxOf();
ok(count(out, 'Invoice approval request') === 4, 'Two approvers get an email and an SMS each', `found ${count(out, 'Invoice approval request')}`);
const queueLinks = [...new Set([...out.matchAll(/href="([^"]*invoices\/queue\?t=[0-9a-f]{36})"/g)].map((m) => decode(m[1])))];
ok(queueLinks.length === 2, 'Two different approver links', String(queueLinks.length));
const queues = {};
for (const l of queueLinks) { const p = await get(l); queues[p.text.includes('Kia ora Hamish') ? 'owner' : 'manager'] = p; }
ok(queues.owner && /7 invoices waiting for your yes, \$91,839\.00 in all, 4 flagged/.test(queues.owner.text), 'Owner: 7 invoices, $91,839.00, 4 flagged', (queues.owner?.text.match(/\d+ invoices waiting[^<]*/) || [])[0]);
ok(queues.manager && /2 invoices waiting for your yes, \$3,133\.75 in all/.test(queues.manager.text), 'Operations manager: 2 small clean invoices, $3,133.75', (queues.manager?.text.match(/\d+ invoices waiting[^<]*/) || [])[0]);
ok(queues.owner.text.indexOf('Flagged') < queues.owner.text.indexOf('All checks passed'), 'Flagged invoices are listed first');
const reviewLink = (queue, ref) => { const card = queue.text.split('<a class="qcard"').find((c) => c.includes(ref)) || ''; const m = card.match(/href="([^"]+)"/); return m ? decode(m[1]) : ''; };

step('1 · Invoices: the review page and the guardrails');
const priceLink = reviewLink(queues.owner, 'AF-77402');
let page = await get(priceLink);
ok(page.text.includes('1 of 7 checks failed') && page.text.includes('Unit price $925.00 is 3.9% above the contract price of $890.00 per t'), 'The flagged invoice says exactly what is wrong');
ok(page.text.includes('Ask the supplier') && page.text.includes('Approve $19,147.50 anyway') && !/>Approve \$19,147\.50</.test(page.text), 'Flagged: no plain Approve button, only "approve anyway"');
ok(count(page.text, 'class="chk') === 7, 'All 7 checks are listed, passed and failed');
page = await get(reviewLink(queues.owner, 'AF-77391'));
ok(page.text.includes('All 7 checks passed') && page.text.includes('Approve $24,564.00'), 'A clean invoice shows its checks and one Approve button');
const cleanTok = token(reviewLink(queues.owner, 'AF-77391'));
const priceTok = token(priceLink);

let res = await post('invoices/review', { t: priceTok, decision: 'approve' });
ok(res.text.includes('This invoice is flagged. Ask the supplier, reject it, or approve it anyway'), 'Plain approve is refused on a flagged invoice');
res = await post('invoices/review', { t: priceTok, decision: 'approve_anyway', note: 'ok' });
ok(res.text.includes('Say why it is safe to pay'), '"Approve anyway" needs a real reason');
res = await post('invoices/review', { t: 'not-a-token', decision: 'approve' });
ok(res.text.includes('no longer valid'), 'A made-up approval link is refused');
res = await post('invoices/review', { t: cleanTok, decision: 'nonsense' });
ok(res.text.includes('Choose one of the options'), 'An unknown decision is refused');
html = await consoleTab('invoices');
ok(count(html, '>Flagged, waiting for a decision<') === 4, 'Nothing changed after the refused attempts');

step('1 · Invoices: query, reject, approve anyway, approve');
// Query the supplier about the changed bank account, using the draft the agent wrote.
const bankLink = reviewLink(queues.owner, 'IFS-30977');
page = await get(bankLink);
ok(page.text.includes('The invoice shows 12-3401-0987650-00, but the account on file is 06-0813-0245190-00') && page.text.includes('Phone the supplier on a number you already have'), 'Bank change: tells the farm to phone the supplier first');
const draft = decode((page.text.match(/name="query_text"[^>]*>([\s\S]*?)<\/textarea>/) || [])[1] || '');
ok(draft.startsWith('Kia ora Dale,') && draft.includes('We will not pay to a different account until we have spoken') && !draft.includes('06-0813-0245190-00'), 'The drafted question is safe to send: it never reveals the account on file', draft.slice(0, 300));
res = await post('invoices/review', { t: token(bankLink), decision: 'query', query_text: draft });
ok(res.text.includes('<h1>Question sent</h1>'), 'Hamish sends the question');
out = await outboxOf();
ok(out.includes('Question about invoice IFS-30977') && out.includes('accounts@ivcfuel.example') && out.includes('Sent for Hamish Gordon'), 'The question went to the supplier, in Hamish\'s name');
res = await post('invoices/review', { t: token(bankLink), decision: 'reject' });
ok(res.text.includes('Already decided'), 'The same invoice cannot be decided twice');
// Reject the duplicate.
const dupLink = reviewLink(queues.owner, 'IFS-30418');
page = await get(dupLink);
ok(page.text.includes('Docket DK-90118 was already invoiced on INV-') && page.text.includes('Supplier invoice number IFS-30418 was already received as INV-'), 'The duplicate: same docket and same invoice number as a paid invoice');
res = await post('invoices/review', { t: token(dupLink), decision: 'reject', note: 'Already paid last month' });
ok(res.text.includes('<h1>Rejected</h1>'), 'Hamish rejects the duplicate');
// Approve the short delivery anyway, with a reason.
const shortLink = reviewLink(queues.owner, 'FS-5588');
page = await get(shortLink);
ok(page.text.includes('docket DK-51207 shows 27.5 t delivered') && page.text.includes('2.5 t not delivered ($987.50 ex GST)'), 'The short delivery: 2.5 t not delivered');
res = await post('invoices/review', { t: token(shortLink), decision: 'approve_anyway', note: 'Driver confirmed the extra 2.5 t arrived on the second truck' });
ok(res.text.includes('<h1>Approved anyway</h1>'), 'Hamish approves it anyway, with a reason');
// Approve the clean ones.
for (const [queue, ref] of [[queues.owner, 'AF-77391'], [queues.owner, 'WC-1203'], [queues.owner, 'AF-77455'], [queues.manager, 'RRV-2204'], [queues.manager, 'MSC-0931']]) {
  res = await post('invoices/review', { t: token(reviewLink(queue, ref)), decision: 'approve' });
  ok(res.text.includes('<h1>Approved</h1>'), `${ref} approved`);
}
html = await consoleTab('invoices');
ok(count(html, '>Approved<') === 6 && count(html, '>Queried with supplier<') === 1 && count(html, '>Rejected<') === 1 && count(html, '>Flagged, waiting for a decision<') === 1, 'Console: 6 approved (5 clean, 1 anyway), 1 queried, 1 rejected, 1 still flagged');
ok(html.includes('Approved anyway: Driver confirmed the extra 2.5 t arrived'), 'The override and its reason stay visible on the invoice');

step('1 · Invoices: the payment file');
r = await run('payments');
const m = r.notice.match(/Prepared (payment-run-(\d{4}-\d{2}-\d{2})-\d{8}T\d{6}\.csv): 6 approved invoices, \$60,472\.75\. Nothing was paid\./);
ok(!!m, 'Payment file: 6 invoices, $60,472.75, "Nothing was paid"', r.notice);
const payDate = m ? m[2] : '';
ok(Number(payDate.slice(8)) === 20 && payDate >= nzToday(), 'The pay date is the next 20th', payDate);
html = await consoleTab('invoices');
const csvLink = linkIn(html.slice(html.indexOf('>Payment files<')), 'payments/file\\?name=');
ok(!!csvLink, 'The file is listed with a download link');
page = await get(csvLink);
ok(page.status === 200 && page.type.includes('csv') && page.text.includes('Aparima Fertiliser Ltd'), 'The CSV downloads');
const total = page.text.split('\n').find((l) => l.startsWith('TOTAL')) || '';
ok(total.includes('60472.75') && total.includes('6 invoices'), 'CSV total is $60,472.75 for 6 invoices', total);
ok(page.text.includes('03-0198-0456721-00') && !page.text.includes('12-3401-0987650-00'), 'Payees are paid to the account on file; the changed account is nowhere in the file');
ok(page.text.includes('Driver confirmed the extra 2.5 t arrived'), 'The overridden flag and its reason travel with the payment');
ok(!page.text.includes('IFS-30977') && !page.text.includes('IFS-30418') && !page.text.includes('AF-77402'), 'Queried, rejected and unapproved invoices are not in the file');
ok(fs.readdirSync(path.join(ROOT, 'files', 'payment-runs')).some((f) => csvLink.includes(f)), 'CSV saved under files/payment-runs');
out = await outboxOf();
ok(out.includes('The agent has not paid anyone. Upload the file to your bank and approve it there.'), 'The owner is told the agent has not paid anyone');
r = await run('payments');
ok(r.notice.includes('No approved invoices are due by'), 'A second payment run finds nothing to pay', r.notice);
html = await consoleTab('invoices');
ok(count(html, '>In payment file<') === 6, '6 invoices now show "In payment file"');

step('1 · Invoices: add an invoice by hand');
page = await get(`${BASE_URL}/webhook/invoices/new`);
ok(page.status === 200 && page.text.includes('Price 10% over the contract') && page.text.includes('Bank account changed'), 'The add-invoice form has the example buttons');
res = await post('invoices/new', { supplier_id: 'S02', item: 'PKE', ref: 'FS-9001', invoice_date: nzToday(), qty: '25', unit: 't', unit_price: '435', docket_ref: 'DK-51260', gst: '', bank_account: '' });
ok(res.status === 303 && /Added INV-\d{4}-\d+ from Fiordland Stockfeeds Ltd/.test(res.notice), 'A price-over invoice is added', res.notice);
res = await post('invoices/new', { supplier_id: 'S01', item: 'Urea (46% N)', ref: 'AF-9002', invoice_date: nzToday(), qty: '20', unit: 't', unit_price: '890', docket_ref: 'DK-20400', gst: '', bank_account: '' });
ok(res.status === 303, 'A normal invoice is added');
res = await post('invoices/new', { supplier_id: 'S04', item: 'Vet consult', ref: 'RRV-9003', invoice_date: nzToday(), qty: '4', unit: 'h', unit_price: '168', docket_ref: '', gst: '80', bank_account: '' });
ok(res.status === 303, 'A wrong-GST invoice is added');
res = await post('invoices/new', { supplier_id: 'S07', item: 'Italian ryegrass seed', ref: 'SSG-9004', invoice_date: nzToday(), qty: '250', unit: 'kg', unit_price: '9.8', docket_ref: '', gst: '', bank_account: '' });
ok(res.status === 303, 'An invoice with no contract is added');
res = await post('invoices/new', { supplier_id: 'S01', item: '', ref: '', invoice_date: '', qty: '0', unit: '', unit_price: '' });
ok(res.status === 200 && res.text.includes('Say what the invoice is for.') && res.text.includes('The quantity must be more than zero.'), 'A bad form is shown again with what to fix');
r = await run('check');
ok(r.notice.includes('Checked 4 invoices: 1 clean, 3 flagged for review'), 'The new invoices are checked: 1 clean, 3 flagged', r.notice);
html = await consoleTab('invoices');
ok(rowFor(html, 'FS-9001').includes('Price 10.1% over the contract'), 'FS-9001: price flagged, in plain words');
ok(rowFor(html, 'RRV-9003').includes('GST or total does not add up'), 'RRV-9003: GST flagged');
ok(rowFor(html, 'SSG-9004').includes('No contract covers this item'), 'SSG-9004: no contract flagged');
ok(rowFor(html, 'AF-9002').includes('All 7 passed'), 'AF-9002: clean');
page = await get(linkIn(rowFor(html, 'AF-9002'), 'invoices/copy\\?t='));
ok(page.text.includes('Tax invoice') && page.text.includes('AF-9002'), 'The invoice copy page opens');

// ------------------------------------------------------------------ 2. farm plan
step('2 · Farm plan: the weekly chase');
r = await run('chase');
ok(r.notice === 'Farm plan chase: Chased 5 items: 3 new requests and 2 reminders. 2 uploads are waiting for a person to check.', 'Chase summary', r.notice);
out = await outboxOf();
ok(count(out, 'Evidence request') === 3 && count(out, 'Evidence reminder') === 2, '3 requests and 2 reminders went out', `${count(out, 'Evidence request')} / ${count(out, 'Evidence reminder')}`);
ok(count(out, 'Farm plan summary') === 3, 'Each farm manager got a summary');
ok(out.includes('gareth@farmdairydesign.example') && out.includes('mere@paddockplan.example') && out.includes('+64210000109'), 'Providers were asked: consultants by email, contractors by SMS');
ok(out.includes('A reminder (request 3)'), 'Hillcrest\'s nutrient budget: this is the third request');
r = await run('chase');
ok(r.notice.includes('Nothing to chase right now.'), 'A second chase does not nag anyone', r.notice);

step('2 · Farm plan: a provider uploads');
html = await consoleTab('plan');
const oreti = farmBlock(html, 'Oreti Flats Dairy');
ok(oreti.includes('6 of 10 verified'), 'Oreti Flats Dairy starts at 6 of 10 verified');
const grazingLink = linkIn(rowFor(oreti, 'Winter grazing plan'), 'farmplan/upload\\?t=');
ok(!!grazingLink, 'The winter grazing plan has an upload link');
page = await get(grazingLink);
ok(page.text.includes('<h1>Winter grazing plan</h1>') && page.text.includes('Oreti Flats Dairy'), 'The provider\'s page opens');
res = await upload('farmplan/upload', token(grazingLink), {}, demo('sample-winter-grazing-plan-oreti-flats.pdf'), 'text/plain', 'notes.txt');
ok(res.text.includes('File type not accepted'), 'A file type that is not allowed is refused');
res = await upload('farmplan/upload', 'not-a-token', {}, demo('sample-winter-grazing-plan-oreti-flats.pdf'));
ok(res.text.includes('Upload link not valid'), 'A made-up upload link is refused');
res = await upload('farmplan/upload', token(grazingLink), { note: 'Updated after the June review' }, demo('sample-winter-grazing-plan-oreti-flats.pdf'));
ok(res.status === 200 && res.text.includes('Your file is uploaded securely'), 'The PDF is uploaded');
ok(fs.readdirSync(path.join(ROOT, 'files', 'evidence')).some((f) => f.startsWith('E-F01-R08-') && f.endsWith('.pdf')), 'The file is stored under files/evidence');
page = await get(grazingLink);
ok(page.text.includes('We have the winter grazing plan'), 'The same link now says it has been received');
out = await outboxOf();
ok(out.includes('Please check: Callum Reid uploaded Winter grazing plan'), 'The farm manager is asked to check it');
html = await consoleTab('plan');
ok(rowFor(farmBlock(html, 'Oreti Flats Dairy'), 'Winter grazing plan').includes('Mark verified'), 'The console offers Mark verified');

step('2 · Farm plan: send back, verify, draft the pack');
res = await post('farmplan/verify', { id: 'E-F01-R05', action: 'back', reason: '', tab: 'plan' });
ok(res.status === 303 && res.notice.includes('Say what is wrong'), 'Sending back needs a reason');
res = await post('farmplan/verify', { id: 'E-F01-R05', action: 'back', reason: 'This is last year\'s budget. We need the current one.', tab: 'plan' });
ok(res.notice === 'Sent back to Mere Parata: Nutrient budget.', 'The nutrient budget is sent back', res.notice);
out = await outboxOf();
ok(out.includes('Please upload again: Nutrient budget for Oreti Flats Dairy') && out.includes('last year&#39;s budget'), 'Mere gets the reason and a fresh link');
html = await consoleTab('plan');
ok(rowFor(farmBlock(html, 'Oreti Flats Dairy'), 'Nutrient budget').includes('Sent back: This is last year'), 'The console shows why it was sent back');
res = await post('farmplan/verify', { id: 'E-F03-R08', action: 'verify', tab: 'gate' });
ok(res.notice.startsWith('Verified: Winter grazing plan (8 of 8 for Mataura Valley Run-off).') && res.notice.includes('Hamish Gordon has been asked to sign it off'), 'Verifying the last item drafts the pack and asks the owner to sign', res.notice);
res = await post('farmplan/verify', { id: 'E-F03-R08', action: 'verify', tab: 'gate' });
ok(res.notice.startsWith('Nothing to check'), 'Verifying twice does nothing');
out = await outboxOf();
ok(out.includes('Evidence pack for Mataura Valley Run-off is ready for your sign-off') && count(out, 'Pack ready for sign-off') === 2, 'The owner gets an email and an SMS');
html = await consoleTab('plan');
const mataura = farmBlock(html, 'Mataura Valley Run-off');
ok(mataura.includes('Ready for sign-off') && mataura.includes('8 of 8 verified'), 'Mataura Valley Run-off is ready for sign-off');
const packLink = linkIn(mataura, 'farmplan/pack\\?t=');
const signLink = linkIn(mataura, 'farmplan/signoff\\?t=');
ok(!!packLink && !!signLink, 'The console links the pack and the sign-off page');
html = await consoleTab('gate');
ok(/<span class="n">\d+<\/span>/.test(html) && html.includes('Evidence pack') && html.includes('Review and sign off'), 'The pack waits on the "needs a person" tab');

step('2 · Farm plan: the pack and the sign-off');
page = await get(packLink);
ok(page.text.includes('Evidence pack for Mataura Valley Run-off') && page.text.includes('Ready for sign-off') && page.text.includes('8 of 8') && page.text.includes('Nothing is sent to the certifier until a person signs this off'), 'The pack lists the evidence and says nothing is sent yet');
ok(page.text.includes('It is not the freshwater farm plan itself'), 'The pack is honest that it is not the plan');
const fileLink = decode((page.text.match(/href="([^"]*farmplan\/file\?p=[^"]+)"/) || [])[1] || '');
page = await get(fileLink);
ok(page.status === 200 && page.type.includes('pdf'), 'An evidence file opens from the pack', page.type);
page = await get(fileLink.replace(/p=[0-9a-f]+/, 'p=nope'));
ok(page.text.includes('No file on record'), 'A wrong pack token cannot open a file');
page = await get(signLink);
ok(page.text.includes('Type your full name to sign') && page.text.includes('Sign off and send to Rowan Pike'), 'The sign-off page asks for a typed name');
res = await post('farmplan/signoff', { t: token(signLink), name: 'Hamish Gordon' });
ok(res.text.includes('Tick the box to confirm'), 'Signing without the confirmation is refused');
res = await post('farmplan/signoff', { t: token(signLink), name: 'Someone Else', confirm: 'yes' });
ok(res.text.includes('Only Hamish Gordon can sign this off'), 'Only the owner can sign');
out = await outboxOf();
ok(!out.includes('signed off by Hamish Gordon'), 'Nothing went to the certifier before the sign-off');
res = await post('farmplan/signoff', { t: token(signLink), name: 'hamish gordon', confirm: 'yes' });
ok(res.text.includes('<h1>Signed off</h1>') && res.text.includes('has gone to Rowan Pike'), 'Hamish signs off');
out = await outboxOf();
ok(out.includes('Evidence pack for Mataura Valley Run-off, signed off by Hamish Gordon') && out.includes('rowan.pike@southerncertifiers.example'), 'Only now does the pack go to the certifier');
res = await post('farmplan/signoff', { t: token(signLink), name: 'Hamish Gordon', confirm: 'yes' });
ok(res.text.includes('already signed off by Hamish Gordon'), 'Signing again does nothing');
html = await consoleTab('plan');
ok(farmBlock(html, 'Mataura Valley Run-off').includes('Sent to certifier') && farmBlock(html, 'Mataura Valley Run-off').includes('Signed off by Hamish Gordon'), 'The console shows it signed off and sent');
let audit = await auditOf();
ok(audit.includes('Signed off the evidence pack') && audit.includes('Sent the pack to Rowan Pike') && audit.includes('Drafted the evidence pack'), 'The log has the draft, the sign-off and the send, in order');

step('2 · Farm plan: the rules keep moving');
res = await post('farmplan/rule', { requirement: 'Updated stock exclusion map', category: 'Environment', applies_to: 'All', tab: 'plan' });
ok(res.notice.startsWith('Added "Updated stock exclusion map" to 3 farms. 1 evidence pack reopened.'), 'A new requirement lands on every farm and reopens the signed pack', res.notice);
res = await post('farmplan/rule', { requirement: 'Updated stock exclusion map', category: 'Environment', applies_to: 'All', tab: 'plan' });
ok(res.notice.includes('is already on the checklist'), 'The same requirement is not added twice');
res = await post('farmplan/rule', { requirement: 'x', tab: 'plan' });
ok(res.notice.includes('Describe the new requirement'), 'A requirement needs a description');
html = await consoleTab('plan');
ok(farmBlock(html, 'Mataura Valley Run-off').includes('Collecting evidence') && farmBlock(html, 'Mataura Valley Run-off').includes('8 of 9 verified'), 'Mataura is collecting again: 8 of 9 verified');
ok(farmBlock(html, 'Hillcrest Station').includes('Updated stock exclusion map') && farmBlock(html, 'Oreti Flats Dairy').includes('Updated stock exclusion map'), 'The new item is on the other farms too');
out = await outboxOf();
ok(out.includes('Checklist changed: Updated stock exclusion map'), 'The owner is told the pack needs signing again');
audit = await auditOf();
ok(audit.includes('Reopened the evidence pack') && audit.includes('Added a requirement: Updated stock exclusion map'), 'The log records the rule change and the reopened pack');
res = await post('farmplan/deadline', { deadline: '2027-05-27', tab: 'plan' });
ok(res.notice.includes('Due date changed from 27 Nov 2027 to 27 May 2027'), 'The due date is one setting', res.notice);
html = await consoleTab('plan');
ok(html.includes('27 May 2027') && !html.includes('<div class="v">27 Nov 2027'), 'Every countdown follows it');
page = await get(packLink);
ok(page.text.includes('27 May 2027'), 'The pack follows it too');
res = await post('farmplan/deadline', { deadline: 'soon', tab: 'plan' });
ok(res.notice.includes('Enter the new due date'), 'A bad date is refused');
await post('farmplan/deadline', { deadline: '2027-11-27', tab: 'plan' });

// ------------------------------------------------------------------ 3. consents and certificates
step('3 · Consents and certificates: the daily watch');
html = await consoleTab('consents');
ok(count(html, '>Expired<') >= 1 && rowFor(html, 'DEMO-WT-0412').includes('Lodge the renewal now'), 'Before the watch: one expired record and the irrigation consent in its lodging window');
r = await run('watch');
ok(r.notice === 'Consents and certificates watch: Checked 12 records: 1 expired, 3 expiring soon, 1 consent renewal to plan, 1 with no evidence. Sent 6 reminders.', 'Watch summary', r.notice);
out = await outboxOf();
ok(count(out, 'Expiry reminder') === 7, '7 reminder messages (the consent owner gets an SMS and an email)', String(count(out, 'Expiry reminder')));
ok(out.includes('Do not assign: 3 restrictions'), 'The operations manager gets a "do not assign" alert');
ok(out.includes('spraying: Jordan Ngata&#39;s agrichemical handler certificate is expired') && out.includes('riding farm quad bikes') && out.includes('driving the farm truck on the road'), 'It names the work not to assign and why');
ok(out.includes('Consents and certificates: 6 need action'), 'The admin gets one summary');
ok(out.includes('the council now decides whether you may keep operating'), 'The consent message explains the council\'s discretion window');
r = await run('watch');
ok(r.notice.endsWith('Sent 0 reminders.'), 'A second watch does not nag', r.notice);
ok(count(await outboxOf(), 'Expiry reminder') === 7, 'No new messages on the second run');
audit = await auditOf();
ok(audit.includes('Reminded: Expired') && audit.includes('Reminded: Expires in 6 days') && audit.includes('Reminded: Lodge the renewal now'), 'The log has one line per reminder, with where each record stands');

step('3 · Consents and certificates: a renewal arrives');
html = await consoleTab('consents');
const jordanRow = rowWith(html, 'Agrichemical handler certificate', 'Jordan Ngata');
const jordanLink = linkIn(jordanRow, 'register/upload\\?t=');
ok(!!jordanLink, 'Jordan has an upload link');
page = await get(jordanLink);
ok(page.text.includes('Agrichemical handler certificate') && /Your agrichemical handler certificate expired \d+ days? ago/.test(page.text) && !page.text.includes('Do not assign') && page.text.includes('New expiry date'), 'The page tells Jordan about his own certificate and asks for the new date');
res = await upload('register/upload', token(jordanLink), { expiry: addDays(nzToday(), -3) }, demo('sample-agrichemical-certificate-jordan-ngata.pdf'));
ok(res.text.includes('That date has passed'), 'A date in the past is refused');
res = await upload('register/upload', token(jordanLink), { expiry: '' }, demo('sample-agrichemical-certificate-jordan-ngata.pdf'));
ok(res.text.includes('Expiry date needed'), 'A missing date is refused');
const newExpiry = addDays(nzToday(), 1826);
res = await upload('register/upload', token(jordanLink), { expiry: newExpiry }, demo('sample-agrichemical-certificate-jordan-ngata.pdf'));
ok(res.text.includes('Your agrichemical handler certificate is uploaded securely'), 'The certificate is uploaded');
html = await consoleTab('consents');
const jr = rowWith(html, 'Agrichemical handler certificate', 'Jordan Ngata');
ok(jr.includes('Check needed') && jr.includes('Expired') && jr.includes(`New: ${fmtDate(newExpiry)}`), 'Until verified, the register keeps the old date and shows the new one beside it');
const viewLink = linkIn(jr, 'register/file\\?t=');
page = await get(viewLink);
ok(page.status === 200 && page.type.includes('pdf'), 'The uploaded file opens');
res = await post('register/verify', { id: 'G04', action: 'back', reason: '', tab: 'consents' });
ok(res.notice.includes('Say what is wrong'), 'Sending back needs a reason');
res = await post('register/verify', { id: 'G04', action: 'verify', tab: 'consents' });
ok(res.notice === `Verified: Agrichemical handler certificate, Jordan Ngata. It now runs to ${fmtDate(newExpiry)}.`, 'Verified: the register takes the new date', res.notice);
html = await consoleTab('consents');
ok(rowWith(html, 'Agrichemical handler certificate', 'Jordan Ngata').includes('Current'), 'Jordan\'s certificate is current');
audit = await auditOf();
ok(audit.includes('Verified the renewal') && audit.includes('Uploaded a renewal'), 'The log has the upload and the verification');
// Quad bike training: upload, then send it back.
const samLink = linkIn(rowFor(html, 'Quad bike training'), 'register/upload\\?t=');
res = await upload('register/upload', token(samLink), { expiry: addDays(nzToday(), 1000) }, demo('sample-quad-bike-training-sam-whitaker.pdf'));
ok(res.text.includes('is uploaded securely'), 'Sam uploads his quad bike training');
res = await post('register/verify', { id: 'G06', action: 'back', reason: 'The photo is cut off. Please send the whole certificate.', tab: 'consents' });
ok(res.notice === 'Sent back to Sam Whitaker: Quad bike training.', 'It is sent back with a reason', res.notice);
out = await outboxOf();
ok(out.includes('needs a different file for your quad bike training') && out.includes('The photo is cut off'), 'Sam gets the reason, by SMS');
// The irrigation consent: record the renewal.
res = await post('register/lodged', { id: 'G01', tab: 'consents' });
ok(res.notice.includes('Recorded: Water take consent (irrigation) renewal lodged') && res.notice.includes('at the council\'s discretion'), 'Recording the renewal explains the 3-to-6-month rule', res.notice);
res = await post('register/lodged', { id: 'G01', tab: 'consents' });
ok(res.notice.includes('already recorded as lodged'), 'It cannot be recorded twice');
res = await post('register/lodged', { id: 'G04', tab: 'consents' });
ok(res.notice.includes('not a consent'), 'Only consents have renewals to lodge');
html = await consoleTab('consents');
ok(rowFor(html, 'DEMO-WT-0412').includes('Renewal lodged'), 'The consent shows "Renewal lodged"');

// ------------------------------------------------------------------ 4. the log and the console
step('4 · The audit trail and the console');
page = await get(`${BASE_URL}/webhook/audit/csv`);
ok(page.status === 200 && page.type.includes('csv') && page.text.startsWith('When (NZ time),Who,Agent or person,Area,Subject,What happened,Detail'), 'The audit trail downloads as CSV');
ok(page.text.includes('Signed off the evidence pack') && page.text.includes('Approved anyway') && page.text.includes('Hamish Gordon') && page.text.includes('Agent'), 'It names both the people and the agent');
const lines = page.text.trim().split('\n').length - 1;
ok(lines > 60, `The CSV has the whole history (${lines} lines)`);
html = await consoleTab('log', '&who=agent');
const agentOnly = html.slice(html.indexOf('>Audit trail<'), html.indexOf('>Messages<'));
ok(agentOnly.includes('who agent') && !agentOnly.includes('who person'), 'The log can be filtered to the agent alone');
html = await consoleTab('log', '&who=person');
ok(!html.slice(html.indexOf('>Audit trail<'), html.indexOf('>Messages<')).includes('who agent'), 'And to people alone');
html = await consoleTab('log', '&flow=Payments');
ok(html.slice(html.indexOf('>Audit trail<'), html.indexOf('>Messages<')).includes('Prepared the payment file. Nothing was paid'), 'Or to one area');

// ------------------------------------------------------------------ edge cases
step('Edge cases');
for (const [route, text] of [['invoices/queue?t=nope', 'no longer valid'], ['invoices/review?t=nope', 'no longer valid'], ['invoices/copy?t=nope', 'no longer valid'], ['farmplan/upload?t=nope', 'upload link has expired'], ['farmplan/pack?t=nope', 'no longer valid'], ['farmplan/signoff?t=nope', 'no longer valid'], ['register/upload?t=nope', 'upload link has expired']]) {
  page = await get(`${BASE_URL}/webhook/${route}`);
  ok(page.text.includes(text), `A made-up link is refused politely: ${route}`);
}
page = await get(`${BASE_URL}/webhook/payments/file?name=../../data/database.sqlite`);
ok(page.text.includes('File not found'), 'Path tricks on the payment file link are refused');
page = await get(`${BASE_URL}/webhook/register/file?t=nope`);
ok(page.text.includes('No file on record'), 'A made-up certificate link shows no file');
r = await run('bogus');
ok(r.notice.includes('Unknown action'), 'An unknown console action is handled');
res = await post('farmplan/verify', { id: 'E-NOPE', action: 'verify', tab: 'plan' });
ok(res.notice.startsWith('Nothing to check'), 'Verifying a made-up item does nothing');

step('Reset for the demo');
r = await run('reset');
ok(r.status === 303, 'Demo data back to Monday morning');
html = await consoleTab('invoices');
ok(count(html, 'Not checked yet') === 9, 'Nine invoices to check again');

console.log(failures ? `\n${failures} check(s) failed.` : '\nAll checks passed.');
process.exit(failures ? 1 : 0);
