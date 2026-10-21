// Fast checks of the business rules, with no n8n running: npm run test-rules
// Runs the same Code-node bodies the workflows use, against the seeded demo data.
import * as DEMO from './demo-data.mjs';
import { runNode, SRC } from './dev-run.mjs';

let failures = 0;
const ok = (cond, label, extra = '') => {
  console.log(`${cond ? '  ✓' : '  ✗'} ${label}${!cond && extra ? `\n      → ${extra}` : ''}`);
  if (!cond) failures++;
};
const step = (t) => console.log(`\n${t}`);
const round = (n) => Math.round(Number((n * 100).toFixed(6))) / 100;
const INVOICE = ['invoice-rules.js'];
const REGISTER = ['register-rules.js'];
const demoPrelude = `const DEMO_DATA = ${JSON.stringify({ ...DEMO })};`;

// ---------------------------------------------------------------- seed data
step('Seed data');
const seed = runNode('reset.code.js', { preludes: INVOICE, prelude: demoPrelude })[0].json;
const bundle = { ...seed, Outbox: [], 'Payment runs': [] };
// Give every row an id, as n8n's data tables do.
for (const rows of Object.values(bundle)) if (Array.isArray(rows)) rows.forEach((r, i) => { r.id = i + 1; });
ok(seed.Invoices.filter((i) => i.status === 'received').length === 9, '9 new invoices to check');
ok(seed.Invoices.filter((i) => i.status === 'paid').length === 4, '4 paid invoices in the history');
ok(seed.Evidence.length === 26, '26 evidence items across 3 farms', `found ${seed.Evidence.length}`);
ok(seed.Register.length === 12, '12 consents and certificates');
ok(seed.Config.some((c) => c.key === 'approver_token_owner' && c.value.length === 36), 'Approver tokens are 36 characters');
const payDay = 20;
ok(seed.Invoices.every((i) => i.due_date.endsWith(`-${payDay}`)), 'Every invoice is due on the 20th');
ok(new Set(seed.Invoices.filter((i) => i.status === 'received').map((i) => i.due_date)).size === 1, 'All new invoices are due on the same pay date');

// ---------------------------------------------------------------- invoice checks
step('Invoice checks on the seeded invoices');
const run = runNode('invoice-match.code.js', { bundle, preludes: INVOICE })[0].json;
const byRef = {};
for (const u of run.updates) {
  const inv = bundle.Invoices.find((i) => i.id === u.id);
  byRef[inv.supplier_ref === 'IFS-30418' ? 'IFS-30418 (new)' : inv.supplier_ref] = u;
}
const failedIds = (ref) => JSON.parse(byRef[ref].reasons).filter((c) => !c.ok).map((c) => c.id);
ok(run.summary.startsWith('Checked 9 invoices: 5 clean, 4 flagged'), 'Summary: 5 clean, 4 flagged', run.summary);
for (const ref of ['AF-77391', 'RRV-2204', 'MSC-0931', 'WC-1203', 'AF-77455']) ok(byRef[ref].result === 'Clean', `${ref} is clean`, failedIds(ref).join());
ok(failedIds('AF-77402').join() === 'price', 'AF-77402: only the price check fails', failedIds('AF-77402').join());
ok(byRef['AF-77402'].at_risk === 724.5, 'AF-77402: $724.50 too much, including GST', String(byRef['AF-77402'].at_risk));
ok(failedIds('FS-5588').join() === 'docket', 'FS-5588: the docket shows less than was invoiced', failedIds('FS-5588').join());
ok(byRef['FS-5588'].at_risk === 1135.63, 'FS-5588: 2.5 t not delivered is $1,135.63 including GST', String(byRef['FS-5588'].at_risk));
ok(failedIds('IFS-30977').join() === 'bank', 'IFS-30977: bank account differs from the one on file', failedIds('IFS-30977').join());
ok(JSON.parse(byRef['IFS-30977'].reasons).find((c) => c.id === 'bank').level === 'high', 'A bank account change is rated high');
ok(failedIds('IFS-30418 (new)').join() === 'docket,duplicate', 'IFS-30418: same docket and same invoice number as a paid invoice', failedIds('IFS-30418 (new)').join());
ok(byRef['IFS-30418 (new)'].at_risk === 7164.5, 'A duplicate puts the whole $7,164.50 at risk');
ok(byRef['RRV-2204'].approver_role === 'manager' && byRef['MSC-0931'].approver_role === 'manager', 'Small clean invoices go to the operations manager');
ok(byRef['AF-77391'].approver_role === 'owner', 'A clean invoice over $2,500 goes to the owner');
ok(run.updates.filter((u) => u.result === 'Review').every((u) => u.approver_role === 'owner'), 'Every flagged invoice goes to the owner');
const totalAtRisk = round(run.updates.reduce((s, u) => s + u.at_risk, 0));
ok(totalAtRisk === 17212.63, 'Held for review in total: $17,212.63', String(totalAtRisk));
ok(run.messages.filter((m) => m.channel === 'Email').length === 2 && run.messages.filter((m) => m.channel === 'SMS').length === 2, 'One email and one SMS per approver, not one per invoice');
ok(run.messages.every((m) => /invoices\/queue\?t=[0-9a-f]{36}/.test(m.link)), 'Every approval message links to that approver\'s list');
ok(run.audit.length === 9 + 2, 'Audit trail: 9 invoices and 2 approval requests', String(run.audit.length));
ok(new Set(run.updates.map((u) => u.review_token)).size === 9, 'Every invoice gets its own review link');

// ---------------------------------------------------------------- one invoice at a time
step('Edge cases');
const base = bundle.Invoices.find((i) => i.supplier_ref === 'AF-77391');
const dayAfter = new Date(Date.parse(`${base.invoice_date}T00:00:00Z`) + 86400000).toISOString().slice(0, 10);
const probeCode = `
const used = {};
for (const i of tableRows('Invoices')) if (i.contract_id && ['matched', 'approved', 'scheduled', 'paid'].includes(i.status)) used[i.contract_id] = (used[i.contract_id] || 0) + Number(i.qty);
const r = checkInvoice(PROBE, { cfg: configFrom(), suppliers: Object.fromEntries(tableRows('Suppliers').map((s) => [s.supplier_id, s])), contracts: tableRows('Contracts'), dockets: tableRows('Dockets'), invoices: tableRows('Invoices'), used });
return [{ json: { failed: r.checks.filter((c) => !c.ok).map((c) => c.id), result: r.result, checks: r.checks, role: r.approver_role } }];`;
function probe(change) {
  const inv = { ...base, invoice_id: 'INV-TEST', received_at: '2999-01-01T00:00:00.000Z', status: 'received', invoice_date: dayAfter, qty: 20, docket_ref: 'DK-20400', ...change };
  inv.net = change.net ?? round(inv.qty * inv.unit_price);
  inv.gst = change.gst ?? round(inv.net * 0.15);
  inv.total = change.total ?? round(inv.net + inv.gst);
  return runNode(null, { code: probeCode, bundle, preludes: INVOICE, prelude: `const PROBE = ${JSON.stringify(inv)};` })[0].json;
}
let r = probe({ supplier_ref: 'N1' });
ok(r.result === 'Clean', 'A normal urea invoice for 20 t at the contract price is clean', r.failed.join());
r = probe({ supplier_ref: 'N2', gst: 3000 });
ok(r.failed.join() === 'gst', 'GST that is not 15% is caught', r.failed.join());
r = probe({ supplier_ref: 'N3', item: 'Mystery additive' });
ok(r.failed.join() === 'contract', 'An item with no contract is flagged', r.failed.join());
r = probe({ supplier_ref: 'N4', qty: 90 });
ok(r.failed.includes('volume') && r.failed.includes('docket'), '90 t takes urea over the contract volume and past the docket', r.failed.join());
r = probe({ supplier_ref: 'N5', docket_ref: '' });
ok(r.failed.join() === 'docket', 'Delivered goods with no docket reference are flagged', r.failed.join());
r = probe({ supplier_ref: 'N6', unit_price: 906 });
ok(r.result === 'Clean', '1.8% over the contract price is within the 2% tolerance', r.failed.join());
r = probe({ supplier_ref: 'N7', unit_price: 910 });
ok(r.failed.join() === 'price', '2.2% over the contract price is flagged', r.failed.join());
r = probe({ supplier_ref: 'N8', invoice_date: '2020-01-01' });
ok(r.failed.includes('contract'), 'A contract that was not in force on the invoice date is flagged', r.failed.join());
r = probe({ supplier_ref: 'N9', unit: 'kg' });
ok(r.failed.includes('price'), 'A different unit from the contract is flagged', r.failed.join());
r = probe({ supplier_ref: 'N10', bank_account: '' });
ok(r.result === 'Clean', 'No bank account on the invoice is fine: payment goes to the account on file', r.failed.join());
r = probe({ supplier_ref: 'N12', docket_ref: 'DK-20318' });
ok(r.failed.join() === 'docket', 'A docket that was already invoiced on another invoice is flagged', r.failed.join());
r = probe({ supplier_ref: 'N11', bank_account: '03 0198 0456721 00' });
ok(r.result === 'Clean', 'The same account typed with spaces still matches', r.failed.join());

// ---------------------------------------------------------------- pay dates
step('Pay dates');
const dates = runNode(null, { code: `return [{ json: { a: nextPayDate('2026-10-05', 20), b: nextPayDate('2026-10-20', 20), c: nextPayDate('2026-10-21', 20), d: nextPayDate('2026-12-28', 20), e: dueDateFor('2026-09-30', 20), f: dueDateFor('2026-12-03', 20) } }];`, preludes: INVOICE })[0].json;
ok(dates.a === '2026-10-20' && dates.b === '2026-10-20', 'Up to and on the 20th, the next pay date is this month\'s 20th', JSON.stringify(dates));
ok(dates.c === '2026-11-20' && dates.d === '2027-01-20', 'After the 20th it is next month\'s 20th (rolling over the year)', JSON.stringify(dates));
ok(dates.e === '2026-10-20' && dates.f === '2027-01-20', 'An invoice is due on the 20th of the following month', JSON.stringify(dates));

// ---------------------------------------------------------------- consents and certificates
step('Consents and certificates');
const cfg = Object.fromEntries(bundle.Config.map((c) => [c.key, c.value]));
const stateOf = (row, today = '2026-10-20') => runNode(null, { code: `return [{ json: registerState(${JSON.stringify(row)}, ${JSON.stringify(cfg)}, ${JSON.stringify(today)}) }];`, bundle, preludes: REGISTER })[0].json;
const consent = (days, extra = {}) => ({ kind: 'Consent', status: 'verified', restriction: 'taking water', expiry_date: new Date(Date.parse('2026-10-20T00:00:00Z') + days * 86400000).toISOString().slice(0, 10), ...extra });
ok(stateOf(consent(400)).state === 'ok', 'A consent 13 months out is current');
ok(stateOf(consent(230)).state === 'plan', 'A consent 7.5 months out: plan the renewal');
ok(stateOf(consent(150)).state === 'lodge', 'A consent 5 months out: lodge now (the council decides whether you may keep operating)');
ok(stateOf(consent(60)).state === 'late', 'A consent 2 months out with no renewal: past the cut-off');
ok(stateOf(consent(-3)).state === 'expired', 'An expired consent is expired');
ok(stateOf(consent(150, { renewal_lodged_at: '2026-10-20T01:00:00Z' })).state === 'lodged', 'A renewal lodged is recorded');
ok(/at the council's discretion/.test(stateOf(consent(150, { renewal_lodged_at: '2026-10-20T01:00:00Z' })).detail), 'A renewal lodged 5 months before expiry says it is at the council\'s discretion');
ok(/may keep operating until the council decides/.test(stateOf(consent(300, { renewal_lodged_at: '2026-10-20T01:00:00Z' })).detail), 'A renewal lodged 10 months before expiry says you may keep operating');
const cert = (days, extra = {}) => ({ kind: 'Certificate', status: 'verified', restriction: 'spraying', expiry_date: new Date(Date.parse('2026-10-20T00:00:00Z') + days * 86400000).toISOString().slice(0, 10), ...extra });
ok(stateOf(cert(100)).state === 'ok' && stateOf(cert(30)).state === 'soon' && stateOf(cert(7)).state === 'urgent' && stateOf(cert(-1)).state === 'expired', 'Certificates: ok, soon at 30 days, urgent at 7, expired');
ok(/Do not assign spraying/.test(stateOf(cert(-12)).detail), 'An expired certificate says what not to assign');
ok(stateOf({ kind: 'Certificate', status: 'missing', expiry_date: '', restriction: 'riding farm quad bikes' }).state === 'missing', 'A certificate with nothing on file is missing');

// ---------------------------------------------------------------- the weekly chase and the daily watch
step('Farm plan chase and consents watch');
const PLAN = ['farmplan-rules.js'];
const chase = runNode('plan-chase.code.js', { bundle, preludes: PLAN })[0].json;
ok(chase.summary === 'Chased 5 items: 3 new requests and 2 reminders. 2 uploads are waiting for a person to check.', 'Chase: 3 new requests, 2 reminders, 2 uploads to check', chase.summary);
ok(chase.messages.filter((m) => m.workflow === 'Evidence request').length === 3 && chase.messages.filter((m) => m.workflow === 'Evidence reminder').length === 2, 'Chase: 5 messages to providers');
ok(chase.messages.filter((m) => m.workflow === 'Farm plan summary').length === 3, 'Chase: one summary per farm manager');
ok(chase.messages.filter((m) => m.channel === 'SMS').length === 3 && chase.messages.filter((m) => m.workflow !== 'Farm plan summary' && m.channel === 'Email').length === 2, 'Providers with a phone get an SMS, consultants get an email');
ok(chase.updates.every((u) => u.status === 'requested' && u.requests_sent >= 1), 'Chased items become "requested" and count the request');
const stopped = { ...bundle, Evidence: bundle.Evidence.map((e) => (e.item_id === 'E-F02-R05' ? { ...e, requests_sent: 3, last_request_at: new Date(Date.now() - 9 * 86400000).toISOString() } : e)) };
const chase3 = runNode('plan-chase.code.js', { bundle: stopped, preludes: PLAN })[0].json;
ok(!chase3.messages.some((m) => m.related === 'E-F02-R05') && /1 need a phone call/.test(chase3.summary), 'After 3 requests the agent stops messaging and asks a person to phone', chase3.summary);

const watch = runNode('watch-check.code.js', { bundle, preludes: REGISTER })[0].json;
ok(watch.summary === 'Checked 12 records: 1 expired, 3 expiring soon, 1 consent renewal to plan, 1 with no evidence. Sent 6 reminders.', 'Watch summary', watch.summary);
ok(watch.messages.filter((m) => m.workflow === 'Expiry reminder').length === 7, '7 reminder messages (the consent owner gets an SMS and an email)');
ok(watch.messages.filter((m) => m.workflow === 'Do not assign').length === 2 && watch.messages.filter((m) => m.workflow === 'Register summary').length === 1, 'One "do not assign" alert (SMS and email) and one summary');
const alert = watch.messages.find((m) => m.workflow === 'Do not assign' && m.channel === 'Email');
ok(alert.body.includes('spraying') && alert.body.includes('riding farm quad bikes') && alert.body.includes('driving the farm truck'), 'The alert names what not to assign');
const watched = { ...bundle, Register: bundle.Register.map((x) => { const u = watch.updates.find((y) => y.id === x.id); return u ? { ...x, ...u } : x; }), Outbox: watch.messages.map((m, i) => ({ ...m, id: i + 1, created_at: new Date().toISOString() })) };
const watch2 = runNode('watch-check.code.js', { bundle: watched, preludes: REGISTER })[0].json;
ok(watch2.messages.length === 0 && watch2.summary.endsWith('Sent 0 reminders.'), 'Running it again straight away sends nothing', `${watch2.messages.length} ${watch2.summary}`);

// ---------------------------------------------------------------- the console, every tab
step('Console');
const consolePrelude = `const CONSOLE_CSS = ${JSON.stringify(SRC('console.css'))};`;
for (const tab of ['gate', 'invoices', 'plan', 'consents', 'log']) {
  const page = runNode('console.code.js', { bundle: watched, webhook: { json: { query: { tab } } }, preludes: [...INVOICE, ...REGISTER, ...PLAN], prelude: consolePrelude })[0].json.html;
  ok(page.includes('Tussock Ridge Farming Ltd') && !/undefined|NaN|\[object Object\]/.test(page), `Tab "${tab}" renders without undefined or NaN`, (page.match(/.{40}(undefined|NaN|\[object Object\]).{40}/) || [])[0]);
}
const gatePage = runNode('console.code.js', { bundle: watched, webhook: { json: { query: {} } }, preludes: [...INVOICE, ...REGISTER, ...PLAN], prelude: consolePrelude })[0].json.html;
ok(/<span class="n">6<\/span>/.test(gatePage), 'The seeded gate has 6 things waiting for a person', (gatePage.match(/<span class="n">\d+/) || [])[0]);
const checkedBundle = { ...watched, Invoices: watched.Invoices.map((i) => { const u = run.updates.find((x) => x.id === i.id); return u ? { ...i, ...u } : i; }) };
const afterCheck = runNode('console.code.js', { bundle: checkedBundle, webhook: { json: { query: {} } }, preludes: [...INVOICE, ...REGISTER, ...PLAN], prelude: consolePrelude })[0].json.html;
ok(afterCheck.includes('Held back for a human look</span><b>$17,213</b>'), 'After the check, the strip shows $17,213 held back (with its dollar sign)', (afterCheck.match(/Held back for a human look<\/span><b>[^<]*/) || [])[0]);
ok(/<span class="n">15<\/span>/.test(afterCheck), 'After the check, 15 things wait for a person (9 invoices, 2 uploads, 4 records)', (afterCheck.match(/<span class="n">\d+/) || [])[0]);

console.log(failures ? `\n${failures} check(s) failed.` : '\nAll checks passed.');
process.exit(failures ? 1 : 0);
