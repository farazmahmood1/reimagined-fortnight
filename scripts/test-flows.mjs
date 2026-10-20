// End-to-end test of all three automations through their real webhooks (n8n must be running).
// Run: npm run test-flows     It resets the demo data before and after.
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, BASE_URL } from './env.mjs';

let failures = 0;
const ok = (cond, label, extra = '') => {
  console.log(`${cond ? '  ✓' : '  ✗'} ${label}${!cond && extra ? `\n      → ${extra}` : ''}`);
  if (!cond) failures++;
};
const step = (t) => console.log(`\n${t}`);
const decode = (s) => s.replace(/&amp;/g, '&');

async function run(action) {
  const res = await fetch(`${BASE_URL}/webhook/console/run`, { method: 'POST', redirect: 'manual', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: `run=${action}` });
  const loc = decodeURIComponent(res.headers.get('location') || '');
  return { status: res.status, notice: loc.split('done=')[1] || '' };
}
const consoleHtml = async () => (await fetch(`${BASE_URL}/webhook/console`)).text();
const section = (html, start, end) => html.slice(html.indexOf(start), end ? html.indexOf(end) : undefined);
const rowFor = (html, text) => (html.split('<tr').find((r) => r.includes(text)) || '');
const linkIn = (htmlPart, pathPart) => { const m = htmlPart.match(new RegExp(`href="(${BASE_URL}/webhook/${pathPart}[^"]*)"`)); return m ? decode(m[1]) : ''; };
const count = (s, needle) => s.split(needle).length - 1;
const getText = async (url) => { const r = await fetch(url); return { status: r.status, text: await r.text(), type: r.headers.get('content-type') || '' }; };

// ------------------------------------------------------------------ 0. reset
step('0 · Reset demo data');
let r = await run('reset');
ok(r.status === 303, 'Reset returns to the console', `HTTP ${r.status}`);
let html = await consoleHtml();
let ts = section(html, '1 · Timesheets', '2 · Compliance documents');
ok(html.includes('Harbourline Recruitment'), 'Console renders');
ok(count(ts, '>Missing<') === 4, '4 timesheets missing', `found ${count(ts, '>Missing<')}`);
ok(count(ts, '>Awaiting client<') === 1, '1 timesheet awaiting the client');

// ------------------------------------------------------------------ 1. timesheets
step('1 · Timesheets: Monday chase');
r = await run('chase');
ok(r.notice.includes('Chased 4 missing timesheets and 1 client approvals'), 'Chase summary', r.notice);
html = await consoleHtml();
const outbox = section(html, '>Outbox', 'Payroll exports');
ok(count(outbox, 'chan sms') === 4, '4 SMS chasers logged', `found ${count(outbox, 'chan sms')}`);
ok(outbox.includes('Reminder: please approve Marek Nowak'), 'Client manager reminded to approve');
ok(outbox.includes('Timesheets w/e'), 'Consultant summary email logged');

step('1 · Timesheets: temp submits, client approves');
ts = section(html, '1 · Timesheets', '2 · Compliance documents');
const tempLink = linkIn(rowFor(ts, 'Aisha Khan'), 'timesheet\\?t=');
ok(!!tempLink, "Aisha's timesheet link is on the console");
let page = await getText(tempLink);
ok(page.status === 200 && page.text.includes('Submit hours'), 'Mobile timesheet form opens');
const token = new URL(tempLink).searchParams.get('t');
const days = [...page.text.matchAll(/name="h_(\d{4}-\d{2}-\d{2})"/g)].map((m) => m[1]);
ok(days.length === 7, 'Form shows the 7 days of last week', days.join(' '));
const hours = [8, 8, 8, 8, 8, 4, 0];
const form = new URLSearchParams({ t: token, notes: 'Saturday overtime for a delivery', confirm: 'yes' });
days.forEach((d, i) => form.set(`h_${d}`, String(hours[i])));
let res = await fetch(`${BASE_URL}/webhook/timesheet`, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: form });
let text = await res.text();
ok(res.status === 200 && text.includes('44 hours sent to Dan Whitfield'), 'Hours submitted (44 h) and sent to the client', text.slice(0, 200));
page = await getText(tempLink);
ok(page.text.includes('already in'), 'The same link now says the hours are already in');
html = await consoleHtml();
const approveLink = linkIn(rowFor(section(html, '1 · Timesheets', '2 · Compliance'), 'Aisha Khan'), 'timesheet/approve\\?t=');
ok(!!approveLink, "Client's approval link appears for Aisha");
page = await getText(approveLink);
ok(page.text.includes('Approve hours, Dan Whitfield?'), 'Approval page shows the hours');
page = await getText(`${approveLink}&a=approve`);
ok(page.text.includes('Approved. Thank you, Dan.'), 'One-click approval works');
page = await getText(`${approveLink}&a=approve`);
ok(page.text.includes('Already approved'), 'Approving twice is handled');
html = await consoleHtml();
ok(section(html, '>Outbox', 'Payroll exports').includes('Good news Aisha'), 'Temp gets an "approved" SMS');

step('1 · Timesheets: payroll export');
r = await run('export');
ok(r.notice.includes('Exported 4 approved timesheets'), 'Export summary', r.notice);
html = await consoleHtml();
const csvLink = linkIn(section(html, 'Payroll exports'), 'payroll/file\\?name=');
ok(!!csvLink, 'Export listed with a download link');
page = await getText(csvLink);
ok(page.status === 200 && page.text.includes('Aisha Khan') && page.text.includes('Northstar Umbrella Ltd'), 'CSV downloads with workers and umbrella routes');
const total = page.text.split('\n').find((l) => l.startsWith('TOTAL')) || '';
ok(total.includes('2478.90') && total.includes('3199.05') && total.includes('720.15'), 'Totals: pay £2,478.90, invoice £3,199.05, margin £720.15', total);
ok(fs.readdirSync(path.join(ROOT, 'files', 'payroll-exports')).some((f) => csvLink.includes(f)), 'CSV saved under files/payroll-exports');
r = await run('export');
ok(r.notice.includes('No newly approved timesheets'), 'Second export finds nothing new', r.notice);

// ------------------------------------------------------------------ 2. documents
step('2 · Compliance documents: daily check');
r = await run('documents');
ok(r.notice.includes('1 blocked, 2 chased, 1 waiting for verification'), 'Document check summary', r.notice);
html = await consoleHtml();
const docs = section(html, '2 · Compliance documents', '3 · Umbrella');
ok(rowFor(docs, 'Samuel Okoro').includes('Do not book'), 'Samuel (expired forklift licence) is "Do not book"');
ok(rowFor(docs, 'Marek Nowak').includes('Expiring soon'), "Marek's right to work shows expiring soon");
ok(count(docs, '>Compliant<') === 4, '4 temps compliant', `found ${count(docs, '>Compliant<')}`);
const docOut = section(html, '>Outbox', 'Payroll exports');
ok(docOut.includes('Hi Samuel, your Forklift licence expired on'), 'Samuel told his licence expired');
ok(docOut.includes('DO NOT BOOK'), 'Consultant alerted: do not book');
r = await run('documents');
ok(r.notice.includes('already reminded today'), 'No duplicate reminders the same day', r.notice);

step('2 · Compliance documents: upload and verify');
const uploadLink = linkIn(rowFor(docs, 'Ryan Patel'), 'documents/upload\\?t=');
ok(!!uploadLink, "Ryan's upload link is on the console");
page = await getText(uploadLink);
ok(page.text.includes('Upload your Food hygiene certificate'), 'Upload page opens');
const pdf = fs.readFileSync(path.join(ROOT, 'demo-files', 'sample-food-hygiene-certificate-ryan-patel.pdf'));
const fd = new FormData();
fd.set('t', new URL(uploadLink).searchParams.get('t'));
fd.set('expiry', '2029-10-12');
fd.set('file', new Blob([pdf], { type: 'application/pdf' }), 'food-hygiene-certificate.pdf');
res = await fetch(`${BASE_URL}/webhook/documents/upload`, { method: 'POST', body: fd });
text = await res.text();
ok(res.status === 200 && text.includes('uploaded securely'), 'PDF uploaded', text.slice(0, 200));
html = await consoleHtml();
const ryan = rowFor(section(html, '2 · Compliance documents', '3 · Umbrella'), 'Ryan Patel');
const verifyLink = linkIn(ryan, 'documents/verify\\?id=');
const viewLink = linkIn(ryan, 'documents/file\\?id=');
ok(!!verifyLink && !!viewLink, 'Console shows "Mark verified" and "View file"');
page = await getText(viewLink);
ok(page.status === 200 && page.type.includes('pdf'), 'Uploaded file can be viewed', page.type);
res = await fetch(verifyLink, { redirect: 'manual' });
ok(res.status === 303 && decodeURIComponent(res.headers.get('location') || '').includes("Verified Ryan Patel's Food hygiene certificate"), 'Consultant verifies the document');
html = await consoleHtml();
ok(rowFor(section(html, '2 · Compliance documents', '3 · Umbrella'), 'Ryan Patel').includes('>Verified<'), 'Document now verified');

// ------------------------------------------------------------------ 3. umbrella
step('3 · Umbrella evidence: request and checks');
r = await run('umbrella');
ok(r.notice.includes('evidence from 2 umbrella companies'), 'Evidence requested from both umbrella companies', r.notice);
html = await consoleHtml();
let umb = section(html, '3 · Umbrella', '>Outbox');
const links = [...umb.matchAll(/href="([^"]*umbrella\/evidence\?t=[^"]*)"/g)].map((m) => decode(m[1]));
ok(links.length === 2, 'Two umbrella upload links', `found ${links.length}`);
for (const [i, file, expectFlag] of [[0, 'northstar-umbrella-payslips.csv', 'Assignment income £2,400.00 vs £2,580.00'], [1, 'clearwater-umbrella-payslips.csv', 'Non-taxable payment of £320.00']]) {
  page = await getText(links[i]);
  ok(page.text.includes('Payslip evidence:'), `Upload page ${i + 1} opens`);
  const body = new FormData();
  body.set('t', new URL(links[i]).searchParams.get('t'));
  body.set('file', new Blob([fs.readFileSync(path.join(ROOT, 'demo-files', file))], { type: 'text/csv' }), file);
  res = await fetch(`${BASE_URL}/webhook/umbrella/evidence`, { method: 'POST', body });
  text = await res.text();
  ok(res.status === 200 && text.includes('We received 2 payslip lines'), `${file} accepted`, text.slice(0, 300));
  html = await consoleHtml();
  umb = section(html, '3 · Umbrella', '>Outbox');
  ok(umb.includes(expectFlag), `Flag raised: ${expectFlag}`);
}
ok(count(umb, '>OK<') === 2 && count(umb, '>Flag<') === 2, '2 payslips OK, 2 flagged for review');
r = await run('umbrella');
ok(r.notice.includes('already in'), 'No further requests once evidence is in', r.notice);

// ------------------------------------------------------------------ edge cases
step('Edge cases');
page = await getText(`${BASE_URL}/webhook/timesheet?t=not-a-real-token`);
ok(page.text.includes('This link has expired'), 'Unknown timesheet link is rejected politely');
page = await getText(`${BASE_URL}/webhook/payroll/file?name=../../data/database.sqlite`);
ok(page.text.includes('File not found'), 'Path tricks on the download link are refused');
r = await run('bogus');
ok(r.notice.includes('Unknown action'), 'Unknown console action is handled');

step('Reset for the demo');
r = await run('reset');
ok(r.status === 303, 'Demo data back to Monday morning');

console.log(failures ? `\n${failures} check(s) failed.` : '\nAll checks passed.');
process.exit(failures ? 1 : 0);
