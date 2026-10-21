// Generates the n8n workflow files in ./workflows from the logic in ./src.
// Run: node scripts/build-workflows.mjs   (setup.mjs runs it for you)
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { ROOT, FILES_DIR, BASE_URL } from './env.mjs';
import * as DEMO from './demo-data.mjs';
import * as SMALL from '../src/small-handlers.mjs';

const OUT = path.join(ROOT, 'workflows');
fs.mkdirSync(OUT, { recursive: true });
for (const f of fs.readdirSync(OUT)) if (f.endsWith('.json')) fs.unlinkSync(path.join(OUT, f));
const FILES = FILES_DIR.replace(/\\/g, '/');
const src = (file) => fs.readFileSync(path.join(ROOT, 'src', file), 'utf8');
const SHARED = src('shared.js');
const INVOICE_RULES = src('invoice-rules.js');
const INVOICE_PAGES = src('invoice-pages.js');
const REGISTER_RULES = src('register-rules.js');
const PLAN_RULES = src('farmplan-rules.js');
const join = (...parts) => parts.join('\n');

export const IDS = {
  LOAD: 'agriLoadData0001', SEND: 'agriSendMessage1', RESET: 'agriResetDemo001',
  INVOICES: 'agriInvoices0001', PLAN: 'agriFarmPlan0001', REGISTER: 'agriRegister0001', CONSOLE: 'agriConsole00001',
};
export const TABLES = {
  Config: [['key', 'string'], ['value', 'string']],
  Suppliers: [['supplier_id', 'string'], ['name', 'string'], ['category', 'string'], ['contact_name', 'string'], ['contact_email', 'string'], ['contact_phone', 'string'], ['bank_account', 'string']],
  Contracts: [['contract_id', 'string'], ['supplier_id', 'string'], ['item', 'string'], ['description', 'string'], ['unit', 'string'], ['agreed_price', 'number'], ['qty_agreed', 'number'], ['valid_from', 'string'], ['valid_to', 'string'], ['needs_docket', 'string'], ['tolerance_pct', 'number']],
  Dockets: [['docket_ref', 'string'], ['supplier_id', 'string'], ['item', 'string'], ['qty', 'number'], ['unit', 'string'], ['delivered_on', 'string'], ['received_by', 'string']],
  Invoices: [['invoice_id', 'string'], ['supplier_id', 'string'], ['supplier_ref', 'string'], ['invoice_date', 'string'], ['due_date', 'string'], ['item', 'string'], ['description', 'string'], ['qty', 'number'], ['unit', 'string'], ['unit_price', 'number'], ['net', 'number'], ['gst', 'number'], ['total', 'number'], ['bank_account', 'string'], ['docket_ref', 'string'], ['source', 'string'], ['received_at', 'string'], ['status', 'string'], ['contract_id', 'string'], ['result', 'string'], ['reasons', 'string'], ['at_risk', 'number'], ['checked_at', 'string'], ['approver_role', 'string'], ['approver_name', 'string'], ['review_token', 'string'], ['approval_requested_at', 'string'], ['decision', 'string'], ['decided_at', 'string'], ['decided_by', 'string'], ['decision_note', 'string'], ['payment_file', 'string']],
  'Payment runs': [['file_name', 'string'], ['pay_date', 'string'], ['invoices', 'number'], ['total', 'number'], ['created_at', 'string']],
  Farms: [['farm_id', 'string'], ['name', 'string'], ['farm_type', 'string'], ['location', 'string'], ['region', 'string'], ['area_ha', 'number'], ['manager_name', 'string'], ['manager_email', 'string'], ['manager_phone', 'string'], ['pack_status', 'string'], ['pack_token', 'string'], ['signoff_token', 'string'], ['ready_at', 'string'], ['signed_by', 'string'], ['signed_at', 'string'], ['sent_at', 'string'], ['sent_to', 'string']],
  Requirements: [['req_id', 'string'], ['requirement', 'string'], ['category', 'string'], ['applies_to', 'string'], ['provider_name', 'string'], ['provider_email', 'string'], ['provider_phone', 'string']],
  Evidence: [['item_id', 'string'], ['farm_id', 'string'], ['req_id', 'string'], ['requirement', 'string'], ['category', 'string'], ['provider_name', 'string'], ['provider_email', 'string'], ['provider_phone', 'string'], ['status', 'string'], ['upload_token', 'string'], ['file_name', 'string'], ['original_name', 'string'], ['received_at', 'string'], ['verified_at', 'string'], ['verified_by', 'string'], ['requests_sent', 'number'], ['last_request_at', 'string'], ['note', 'string']],
  Register: [['reg_id', 'string'], ['farm_id', 'string'], ['kind', 'string'], ['type', 'string'], ['reference', 'string'], ['holder', 'string'], ['responsible_name', 'string'], ['responsible_email', 'string'], ['responsible_phone', 'string'], ['restriction', 'string'], ['expiry_date', 'string'], ['status', 'string'], ['new_expiry', 'string'], ['upload_token', 'string'], ['file_name', 'string'], ['original_name', 'string'], ['received_at', 'string'], ['verified_at', 'string'], ['verified_by', 'string'], ['reminders_sent', 'number'], ['last_reminder_at', 'string'], ['renewal_lodged_at', 'string'], ['last_state', 'string'], ['note', 'string']],
  Outbox: [['created_at', 'string'], ['channel', 'string'], ['to_name', 'string'], ['to_address', 'string'], ['subject', 'string'], ['body', 'string'], ['link', 'string'], ['related', 'string'], ['workflow', 'string'], ['delivery', 'string']],
  'Audit log': [['at', 'string'], ['actor', 'string'], ['actor_type', 'string'], ['flow', 'string'], ['subject', 'string'], ['action', 'string'], ['detail', 'string']],
};
const TABLE_NAMES = Object.keys(TABLES);
const SEEDED = ['Config', 'Suppliers', 'Contracts', 'Dockets', 'Invoices', 'Farms', 'Requirements', 'Evidence', 'Register', 'Audit log'];
const TZ = 'Pacific/Auckland';

// ---------------------------------------------------------------- node factories
const stableUuid = (seed) => {
  const h = crypto.createHash('sha1').update(seed).digest('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
};
function workflow(id, name, description) {
  const nodes = [];
  const connections = {};
  const add = (n) => { n.id = stableUuid(`${id}:${n.name}`); nodes.push(n); return n.name; };
  const link = (from, to, output = 0) => {
    connections[from] ??= { main: [] };
    while (connections[from].main.length <= output) connections[from].main.push([]);
    connections[from].main[output].push({ node: to, type: 'main', index: 0 });
  };
  const chain = (...names) => names.slice(1).forEach((n, i) => link(names[i], n));
  const build = (active = true) => ({
    id, name, nodes, connections, active, pinData: {},
    settings: { executionOrder: 'v1', timezone: TZ, saveDataSuccessExecution: 'all', saveManualExecutions: true, callerPolicy: 'workflowsFromSameOwner' },
    meta: { templateCredsSetupCompleted: true, description },
    tags: [],
  });
  return { add, link, chain, build, id };
}
const N = (name, type, typeVersion, position, parameters, extra = {}) => ({ name, type, typeVersion, position, parameters, ...extra });
const code = (name, pos, body, { webhook, prelude = '' } = {}) => {
  let js = `${SHARED}\n${prelude}\n${body}`;
  if (webhook) js = js.replaceAll("$('Webhook')", `$('${webhook}')`);
  return N(name, 'n8n-nodes-base.code', 2, pos, { jsCode: js });
};
const webhook = (wfId, name, pos, method, p) => N(name, 'n8n-nodes-base.webhook', 2.1, pos, { httpMethod: method, path: p, responseMode: 'responseNode', options: {} }, { webhookId: stableUuid(`${wfId}:webhook:${name}`) });
const schedule = (name, pos, interval) => N(name, 'n8n-nodes-base.scheduleTrigger', 1.2, pos, { rule: { interval: [interval] } });
const calledBy = (name, pos) => N(name, 'n8n-nodes-base.executeWorkflowTrigger', 1.1, pos, { inputSource: 'passthrough' });
const runWorkflow = (name, pos, workflowId) => N(name, 'n8n-nodes-base.executeWorkflow', 1.1, pos, { source: 'database', workflowId: { __rl: true, mode: 'id', value: workflowId }, mode: 'once', options: { waitForSubWorkflow: true } });
const loadData = (name, pos) => runWorkflow(name, pos, IDS.LOAD);
const sendMessages = (name, pos) => runWorkflow(name, pos, IDS.SEND);
const splitOut = (name, pos, field) => N(name, 'n8n-nodes-base.splitOut', 1, pos, { fieldToSplitOut: field, include: 'noOtherFields', options: {} });
const tableRef = (table) => ({ __rl: true, mode: 'name', value: table });
const autoMap = { mappingMode: 'autoMapInputData', value: {}, matchingColumns: [], schema: [], attemptToConvertTypes: false, convertFieldsToString: false };
const dtGet = (table, pos) => N(table, 'n8n-nodes-base.dataTable', 1.1, pos, { resource: 'row', operation: 'get', dataTableId: tableRef(table), matchType: 'anyCondition', filters: {}, returnAll: true }, { executeOnce: true, alwaysOutputData: true });
const dtInsert = (name, pos, table) => N(name, 'n8n-nodes-base.dataTable', 1.1, pos, { resource: 'row', operation: 'insert', dataTableId: tableRef(table), columns: autoMap, options: {} });
const dtUpdate = (name, pos, table) => N(name, 'n8n-nodes-base.dataTable', 1.1, pos, {
  resource: 'row', operation: 'update', dataTableId: tableRef(table), matchType: 'allConditions',
  filters: { conditions: [{ keyName: 'id', condition: 'eq', keyValue: '={{ $json.id }}' }] }, columns: autoMap, options: {},
});
const dtCreate = (table, pos) => N(`Create ${table}`, 'n8n-nodes-base.dataTable', 1.1, pos, {
  resource: 'table', operation: 'create', tableName: table, columns: { column: TABLES[table].map(([name, type]) => ({ name, type })) }, options: { createIfNotExists: true },
}, { executeOnce: true });
const dtClear = (table, pos) => N(`Clear ${table}`, 'n8n-nodes-base.dataTable', 1.1, pos, { resource: 'table', operation: 'clear', dataTableId: tableRef(table) }, { executeOnce: true });
const respondHtml = (name, pos) => N(name, 'n8n-nodes-base.respondToWebhook', 1.1, pos, {
  respondWith: 'text', responseBody: '={{ $json.html }}',
  options: { responseHeaders: { entries: [{ name: 'Content-Type', value: 'text/html; charset=utf-8' }, { name: 'Cache-Control', value: 'no-store' }] } },
});
const respondRedirect = (name, pos) => N(name, 'n8n-nodes-base.respondToWebhook', 1.1, pos, { respondWith: 'redirect', redirectURL: '={{ $json.location }}', options: { responseCode: 303 } });
const respondFile = (name, pos, disposition) => N(name, 'n8n-nodes-base.respondToWebhook', 1.1, pos, {
  respondWith: 'binary', responseDataSource: 'automatically',
  options: { responseHeaders: { entries: [{ name: 'Content-Disposition', value: `=${disposition}; filename="{{ $json.fileName.split('/').pop() }}"` }, { name: 'Cache-Control', value: 'no-store' }] } },
});
const ifNotEmpty = (name, pos, expr) => N(name, 'n8n-nodes-base.if', 2.2, pos, {
  conditions: {
    options: { caseSensitive: true, leftValue: '', typeValidation: 'strict', version: 2 },
    conditions: [{ id: stableUuid(`if:${name}`), leftValue: `={{ String(${expr} ?? '') }}`, rightValue: '', operator: { type: 'string', operation: 'notEmpty', singleValue: true } }],
    combinator: 'and',
  },
  options: {},
});
const ifEquals = (name, pos, expr, value) => N(name, 'n8n-nodes-base.if', 2.2, pos, {
  conditions: {
    options: { caseSensitive: true, leftValue: '', typeValidation: 'strict', version: 2 },
    conditions: [{ id: stableUuid(`if:${name}`), leftValue: `={{ String(${expr} ?? '') }}`, rightValue: value, operator: { type: 'string', operation: 'equals' } }],
    combinator: 'and',
  },
  options: {},
});
const writeFile = (name, pos) => N(name, 'n8n-nodes-base.readWriteFile', 1, pos, { operation: 'write', fileName: `=${FILES}/{{ $json.savePath }}`, dataPropertyName: 'data', options: {} });
const readFile = (name, pos) => N(name, 'n8n-nodes-base.readWriteFile', 1, pos, { operation: 'read', fileSelector: `=${FILES}/{{ $json.filePath }}`, options: { dataPropertyName: 'data' } });
const note = (name, pos, content, width = 420, height = 160, color = 7) => N(name, 'n8n-nodes-base.stickyNote', 1, pos, { content, width, height, color });
const RESULT = `// Hand the automation's summary back to the console.
let summary = $input.first().json.summary;
return [{ json: { summary: summary || 'Done.' } }];`;

const write = (wf, active = true) => {
  const data = wf.build(active);
  fs.writeFileSync(path.join(OUT, `${data.id}.json`), JSON.stringify(data, null, 2));
  return data;
};

// ================================================================ Shared · Load data
{
  const wf = workflow(IDS.LOAD, 'Shared · Load data', 'Reads every data table once and returns one item with an array per table. Stands in for the farm\'s accounts, records and register.');
  wf.add(note('About', [-40, 80], '## Shared · Load data\nReads the farm\'s records in one go so each automation starts with the whole picture.\n\nIn a live business this is where the calls to Xero, the farm software and the document store go.', 560, 150, 5));
  wf.add(calledBy('When called by a workflow', [0, 300]));
  let prev = 'When called by a workflow';
  TABLE_NAMES.forEach((t, i) => { wf.add(dtGet(t, [220 + i * 200, 300])); wf.link(prev, t); prev = t; });
  wf.add(code('Bundle tables', [220 + TABLE_NAMES.length * 200, 300], `const tables = ${JSON.stringify(TABLE_NAMES)};
const out = {};
for (const t of tables) out[t] = $(t).all().map((i) => i.json).filter((r) => r && r.id !== undefined);
return [{ json: out }];`));
  wf.link(prev, 'Bundle tables');
  write(wf);
}

// ================================================================ Shared · Send message
{
  const wf = workflow(IDS.SEND, 'Shared · Send message', 'The only workflow that sends SMS or email. Demo mode logs everything to the Outbox table.');
  wf.add(note('About', [-40, 40], '## Shared · Send message\nEvery automation hands its texts and emails to this workflow, so there is one place to switch sending on or off.\n\n**Demo mode:** messages are logged to the Outbox table only.\n**Live:** add Twilio and SMTP credentials, enable the two grey nodes, then set `sms_enabled` / `email_enabled` to `true` in the Config table.\n\nMessages to fictional demo addresses (+64 21 000 xxxx and *.example) are never sent, even when live sending is on.', 640, 230, 5));
  wf.add(calledBy('When called by a workflow', [0, 340]));
  wf.add(dtGet('Config', [220, 340]));
  wf.add(code('Prepare messages', [440, 340], `const cfg = Object.fromEntries($('Config').all().map((i) => i.json).filter((r) => r && r.key).map((r) => [r.key, r.value]));
const live = (channel) => (channel === 'SMS' ? cfg.sms_enabled : cfg.email_enabled) === 'true';
// Fictional demo addresses are never delivered, even in live mode.
const isDemoAddress = (a) => /\\.example$/i.test(String(a).split('@').pop()) || /^\\+6421000/.test(String(a));
const msgs = $('When called by a workflow').all().map((i) => i.json).filter((m) => m && m.to_address && m.body);
return msgs.map((m, i) => ({ json: {
  created_at: new Date(Date.now() + i).toISOString(), channel: m.channel, to_name: m.to_name || '', to_address: m.to_address,
  subject: m.subject || '', body: m.body, link: m.link || '', related: m.related || '', workflow: m.workflow || '',
  delivery: live(m.channel) && isDemoAddress(m.to_address) ? 'Not sent: demo address' : live(m.channel) ? (m.channel === 'SMS' ? 'Sent by SMS (Twilio)' : 'Sent by email (SMTP)') : 'Demo mode: logged, not sent',
} }));`));
  wf.add(dtInsert('Log to Outbox', [660, 340], 'Outbox'));
  wf.add(code('SMS to send', [880, 220], `return $input.all().filter((i) => i.json.channel === 'SMS' && String(i.json.delivery).startsWith('Sent'));`));
  wf.add(N('Send SMS (Twilio)', 'n8n-nodes-base.twilio', 1, [1100, 220], { resource: 'sms', operation: 'send', from: '+64210000100', to: '={{ $json.to_address }}', message: "={{ $json.body }}{{ $json.link ? ' ' + $json.link : '' }}", options: {} }, { disabled: true, notes: 'Add your Twilio credential and a sender number, then enable.' }));
  wf.add(code('Emails to send', [880, 440], `return $input.all().filter((i) => i.json.channel === 'Email' && String(i.json.delivery).startsWith('Sent'));`));
  wf.add(N('Send email (SMTP)', 'n8n-nodes-base.emailSend', 2.1, [1100, 440], { operation: 'send', fromEmail: 'agent@tussockridge.example', toEmail: '={{ $json.to_address }}', subject: '={{ $json.subject }}', emailFormat: 'text', text: "={{ $json.body }}\n\n{{ $json.link }}", options: { appendAttribution: false } }, { disabled: true, notes: 'Add your SMTP credential and a sender address, then enable.' }));
  wf.add(code('Done', [880, 620], `return [{ json: { summary: \`Logged \${$('Log to Outbox').all().length} message(s).\` } }];`));
  wf.chain('When called by a workflow', 'Config', 'Prepare messages', 'Log to Outbox');
  wf.link('Log to Outbox', 'SMS to send');
  wf.link('Log to Outbox', 'Emails to send');
  wf.link('Log to Outbox', 'Done');
  wf.link('SMS to send', 'Send SMS (Twilio)');
  wf.link('Emails to send', 'Send email (SMTP)');
  write(wf);
}

// ================================================================ Demo · Reset data
{
  const wf = workflow(IDS.RESET, 'Demo · Reset data', 'Creates the data tables if needed and reloads the fictional Monday-morning demo data.');
  wf.add(note('About', [-40, 60], '## Demo · Reset data\nCreates the data tables (first run), clears them and loads the fictional Tussock Ridge Farming data: nine invoices to check, farm plan evidence partly collected, and consents running out. Every date is worked out from today, New Zealand time.', 680, 160, 5));
  wf.add(calledBy('When called by a workflow', [0, 300]));
  wf.add(N('Run manually', 'n8n-nodes-base.manualTrigger', 1, [0, 480], {}));
  let prev = null;
  TABLE_NAMES.forEach((t, i) => {
    const name = wf.add(dtCreate(t, [220 + i * 180, 300]));
    if (prev) wf.link(prev, name); else { wf.link('When called by a workflow', name); wf.link('Run manually', name); }
    prev = name;
  });
  TABLE_NAMES.forEach((t, i) => {
    const name = wf.add(dtClear(t, [220 + i * 180, 520]));
    wf.link(prev, name);
    prev = name;
  });
  const demo = { CONFIG: DEMO.CONFIG, SUPPLIERS: DEMO.SUPPLIERS, CONTRACTS: DEMO.CONTRACTS, DOCKETS: DEMO.DOCKETS, INVOICES: DEMO.INVOICES, HISTORY: DEMO.HISTORY, FARMS: DEMO.FARMS, PROVIDERS: DEMO.PROVIDERS, REQUIREMENTS: DEMO.REQUIREMENTS, EVIDENCE_START: DEMO.EVIDENCE_START, REGISTER: DEMO.REGISTER, STAFF: DEMO.STAFF };
  wf.add(code('Build demo data', [220 + TABLE_NAMES.length * 180, 520], src('reset.code.js'), { prelude: join(`const DEMO_DATA = ${JSON.stringify(demo)};`, INVOICE_RULES) }));
  wf.link(prev, 'Build demo data');
  const x = 220 + (TABLE_NAMES.length + 1) * 180;
  SEEDED.forEach((t, i) => {
    wf.add(splitOut(`Rows: ${t}`, [x, 300 + i * 150], t));
    wf.add(dtInsert(`Insert ${t}`, [x + 220, 300 + i * 150], t));
    wf.link('Build demo data', `Rows: ${t}`);
    wf.link(`Rows: ${t}`, `Insert ${t}`);
  });
  wf.add(code('Done', [x, 300 + SEEDED.length * 150], `return [{ json: { summary: $('Build demo data').first().json.summary } }];`));
  wf.link('Build demo data', 'Done');
  write(wf);
}

// ================================================================ lane layout helpers
// Each lane is a grey box (sticky note) holding one trigger and its flow, left to right.
// Rows inside a lane are 140 px apart; parallel branches run top-to-bottom, which is also
// n8n's execution order, so write-backs happen before the page or summary is returned.
const COL = 200;
const ROW = 140;
let laneY = 0;
function laneBox(wf, key, rows, cols, title, text, color = 7) {
  const y = laneY;
  laneY += 80 + rows * ROW + 40;
  wf.add(note(`Lane: ${key}`, [-70, y], `### ${title}\n${text}`, cols * COL + 120, 80 + rows * ROW, color));
  return (col, row = 0) => [col * COL, y + 80 + row * ROW];
}
function header(wf, y, title, text, width = 1700) {
  wf.add(note('About this workflow', [-70, y], `## ${title}\n${text}`, width, 140, 5));
  laneY = y + 180;
}

// ================================================================ 1 · Supplier invoices
{
  const W = IDS.INVOICES;
  const wf = workflow(W, '1 · Supplier invoices: check → approve → payment file', 'Reads each supplier invoice, matches it to its contract and delivery docket, runs seven checks, asks the right person to decide, and prepares the payment file. It never approves or pays anything.');
  header(wf, -200, '1 · Supplier invoices: check → approve → payment file', 'The agent reads each invoice, matches it to its contract and delivery docket, and runs seven checks: contract, price, volume, docket, GST, duplicate and bank account.\nA person approves every invoice (the owner decides anything over the limit and everything flagged). The agent then prepares one payment file. A person uploads it to the bank.\nIn a live business, "Load data" and the update nodes talk to Xero, your inbox and your document store.');

  // Console lane: routes to the check or the payment lane.
  let at = laneBox(wf, 'console', 1, 2, 'Run from the demo console', 'The console sends run = check or payments.');
  wf.add(calledBy('Run from console', at(0)));
  wf.add(ifEquals('Payments or check?', at(1), '$json.run', 'payments'));
  wf.link('Run from console', 'Payments or check?');

  at = laneBox(wf, 'check', 4, 6, 'Weekdays 07:30 NZ: check new invoices', 'Matches each invoice to its contract and docket, runs the seven checks, and sends each approver one list, not one message per invoice.');
  wf.add(schedule('Weekdays 07:30', at(0, 0), { field: 'weeks', weeksInterval: 1, triggerAtDay: [1, 2, 3, 4, 5], triggerAtHour: 7, triggerAtMinute: 30 }));
  wf.add(loadData('Load data (check)', at(1, 0)));
  wf.add(code('Check invoices', at(2, 0), src('invoice-match.code.js'), { prelude: INVOICE_RULES }));
  wf.chain('Weekdays 07:30', 'Load data (check)', 'Check invoices');
  wf.add(splitOut('Invoice results', at(3, 0), 'updates')); wf.add(dtUpdate('Update invoices', at(4, 0), 'Invoices'));
  wf.add(splitOut('Approval requests', at(3, 1), 'messages')); wf.add(sendMessages('Ask approvers to decide', at(4, 1)));
  wf.add(splitOut('Check audit', at(3, 2), 'audit')); wf.add(dtInsert('Log the checks', at(4, 2), 'Audit log'));
  wf.add(code('Check result', at(3, 3), RESULT));
  for (const n of ['Invoice results', 'Approval requests', 'Check audit', 'Check result']) wf.link('Check invoices', n);
  wf.link('Invoice results', 'Update invoices'); wf.link('Approval requests', 'Ask approvers to decide'); wf.link('Check audit', 'Log the checks');
  wf.link('Payments or check?', 'Load data (check)', 1);

  at = laneBox(wf, 'payments', 5, 7, '18th of each month 09:00 NZ: prepare the payment file', 'Approved invoices due by the next pay date go into one bank file. Always the bank account on file. The agent has no bank access: a person uploads the file.');
  wf.add(schedule('18th of the month 09:00', at(0, 0), { field: 'months', monthsInterval: 1, triggerAtDayOfMonth: 18, triggerAtHour: 9 }));
  wf.add(loadData('Load data (payments)', at(1, 0)));
  wf.add(code('Build payment file', at(2, 0), src('payment-run.code.js'), { prelude: INVOICE_RULES }));
  wf.add(ifNotEmpty('Anything to pay?', at(3, 0), '$json.fileName'));
  wf.add(N('Save payment file', 'n8n-nodes-base.readWriteFile', 1, at(4, 0), { operation: 'write', fileName: `=${FILES}/payment-runs/{{ $json.fileName }}`, dataPropertyName: 'data', options: {} }));
  wf.chain('18th of the month 09:00', 'Load data (payments)', 'Build payment file', 'Anything to pay?');
  wf.link('Anything to pay?', 'Save payment file', 0);
  wf.add(splitOut('Invoices in the file', at(5, 0), 'updates')); wf.add(dtUpdate('Mark as in payment file', at(6, 0), 'Invoices'));
  wf.add(splitOut('Payment file record', at(5, 1), 'runs')); wf.add(dtInsert('Record the payment file', at(6, 1), 'Payment runs'));
  wf.add(splitOut('Payment emails', at(5, 2), 'messages')); wf.add(sendMessages('Tell the owner and admin', at(6, 2)));
  wf.add(splitOut('Payment audit', at(5, 3), 'audit')); wf.add(dtInsert('Log the payment file', at(6, 3), 'Audit log'));
  wf.add(code('Payment result', at(5, 4), RESULT));
  for (const n of ['Invoices in the file', 'Payment file record', 'Payment emails', 'Payment audit', 'Payment result']) wf.link('Save payment file', n);
  wf.link('Anything to pay?', 'Payment result', 1);
  wf.link('Invoices in the file', 'Mark as in payment file'); wf.link('Payment file record', 'Record the payment file');
  wf.link('Payment emails', 'Tell the owner and admin'); wf.link('Payment audit', 'Log the payment file');
  wf.link('Payments or check?', 'Load data (payments)', 0);

  at = laneBox(wf, 'queue', 1, 4, 'Approver opens their list', 'The link in the text or email. It lists only the invoices that person decides.');
  wf.add(webhook(W, 'Approver opens list', at(0), 'GET', 'invoices/queue'));
  wf.add(loadData('Load data (list)', at(1)));
  wf.add(code('Render approver list', at(2), src('invoice-queue.code.js'), { webhook: 'Approver opens list', prelude: INVOICE_RULES }));
  wf.add(respondHtml('Show list', at(3)));
  wf.chain('Approver opens list', 'Load data (list)', 'Render approver list', 'Show list');

  at = laneBox(wf, 'review', 1, 4, 'Approver opens one invoice', 'Every check the agent ran, in plain words, and the decision buttons. Flagged invoices put "ask the supplier" first.');
  wf.add(webhook(W, 'Approver opens invoice', at(0), 'GET', 'invoices/review'));
  wf.add(loadData('Load data (review)', at(1)));
  wf.add(code('Render invoice', at(2), src('invoice-review.code.js'), { webhook: 'Approver opens invoice', prelude: join(INVOICE_RULES, INVOICE_PAGES) }));
  wf.add(respondHtml('Show invoice', at(3)));
  wf.chain('Approver opens invoice', 'Load data (review)', 'Render invoice', 'Show invoice');

  at = laneBox(wf, 'decide', 4, 6, 'Approver decides', 'Approve, approve anyway (a written reason is required), ask the supplier (the agent drafted the message; sending needs the click), or reject. Every decision is logged with a name.');
  wf.add(webhook(W, 'Approver decides', at(0, 0), 'POST', 'invoices/review'));
  wf.add(loadData('Load data (decide)', at(1, 0)));
  wf.add(code('Record decision', at(2, 0), src('invoice-decide.code.js'), { webhook: 'Approver decides', prelude: join(INVOICE_RULES, INVOICE_PAGES) }));
  wf.chain('Approver decides', 'Load data (decide)', 'Record decision');
  wf.add(splitOut('Decision', at(3, 0), 'updates')); wf.add(dtUpdate('Save decision', at(4, 0), 'Invoices'));
  wf.add(splitOut('Supplier question', at(3, 1), 'messages')); wf.add(sendMessages('Email the supplier', at(4, 1)));
  wf.add(splitOut('Decision audit', at(3, 2), 'audit')); wf.add(dtInsert('Log the decision', at(4, 2), 'Audit log'));
  wf.add(respondHtml('Show decision', at(3, 3)));
  for (const n of ['Decision', 'Supplier question', 'Decision audit', 'Show decision']) wf.link('Record decision', n);
  wf.link('Decision', 'Save decision'); wf.link('Supplier question', 'Email the supplier'); wf.link('Decision audit', 'Log the decision');

  at = laneBox(wf, 'copy', 1, 4, 'View the invoice as received', 'Opens a copy of the invoice record, laid out like a tax invoice.');
  wf.add(webhook(W, 'Open invoice copy', at(0), 'GET', 'invoices/copy'));
  wf.add(loadData('Load data (copy)', at(1)));
  wf.add(code('Render invoice copy', at(2), src('invoice-copy.code.js'), { webhook: 'Open invoice copy', prelude: join(INVOICE_RULES, INVOICE_PAGES) }));
  wf.add(respondHtml('Show invoice copy', at(3)));
  wf.chain('Open invoice copy', 'Load data (copy)', 'Render invoice copy', 'Show invoice copy');

  at = laneBox(wf, 'new-form', 1, 4, 'Add an invoice by hand (demo)', 'The form, with examples that each break one rule. In your business invoices are read from the invoice inbox.');
  wf.add(webhook(W, 'Open add-invoice form', at(0), 'GET', 'invoices/new'));
  wf.add(loadData('Load data (form)', at(1)));
  wf.add(code('Render add-invoice form', at(2), src('invoice-new-form.code.js'), { webhook: 'Open add-invoice form', prelude: join(INVOICE_RULES, INVOICE_PAGES) }));
  wf.add(respondHtml('Show add-invoice form', at(3)));
  wf.chain('Open add-invoice form', 'Load data (form)', 'Render add-invoice form', 'Show add-invoice form');

  at = laneBox(wf, 'new-save', 4, 6, 'Save the invoice', 'Stored as "new, not checked yet". Checking is a separate step, so you can see it happen.');
  wf.add(webhook(W, 'Save add-invoice form', at(0, 0), 'POST', 'invoices/new'));
  wf.add(loadData('Load data (save)', at(1, 0)));
  wf.add(code('Save invoice', at(2, 0), src('invoice-new-save.code.js'), { webhook: 'Save add-invoice form', prelude: join(INVOICE_RULES, INVOICE_PAGES) }));
  wf.chain('Save add-invoice form', 'Load data (save)', 'Save invoice');
  wf.add(splitOut('New invoice', at(3, 0), 'inserts')); wf.add(dtInsert('Add the invoice', at(4, 0), 'Invoices'));
  wf.add(splitOut('Invoice audit', at(3, 1), 'audit')); wf.add(dtInsert('Log the new invoice', at(4, 1), 'Audit log'));
  wf.add(ifNotEmpty('Form needs fixing?', at(3, 2), '$json.html'));
  wf.add(respondHtml('Show the form again', at(4, 2)));
  wf.add(respondRedirect('Back to the console', at(4, 3)));
  for (const n of ['New invoice', 'Invoice audit', 'Form needs fixing?']) wf.link('Save invoice', n);
  wf.link('New invoice', 'Add the invoice'); wf.link('Invoice audit', 'Log the new invoice');
  wf.link('Form needs fixing?', 'Show the form again', 0); wf.link('Form needs fixing?', 'Back to the console', 1);

  at = laneBox(wf, 'download', 2, 5, 'Download a payment file', 'Only exact payment file names are accepted.');
  wf.add(webhook(W, 'Download payment file', at(0, 0), 'GET', 'payments/file'));
  wf.add(code('Check file name', at(1, 0), SMALL.PAYMENT_FILE, { webhook: 'Download payment file' }));
  wf.add(ifEquals('File name valid?', at(2, 0), '$json.ok', 'true'));
  wf.add(readFile('Read payment file', at(3, 0)));
  wf.add(respondFile('Send payment file', at(4, 0), 'attachment'));
  wf.add(respondHtml('Not found page', at(3, 1)));
  wf.chain('Download payment file', 'Check file name', 'File name valid?');
  wf.link('File name valid?', 'Read payment file', 0); wf.link('File name valid?', 'Not found page', 1);
  wf.link('Read payment file', 'Send payment file');
  write(wf);
}

// ================================================================ 2 · Farm plan evidence
{
  const W = IDS.PLAN;
  const wf = workflow(W, '2 · Farm plan evidence: chase → verify → sign off', 'Chases the people who hold each piece of evidence, lets the farm manager verify uploads, drafts the evidence pack when a farm is complete, and sends it to the certifier only after the owner signs it off.');
  header(wf, -200, '2 · Farm plan evidence: chase → verify → sign off', 'Weekly: ask each provider for what is missing, remind after 7 days, and stop at 3 requests so a person can phone.\nA person verifies every upload. When a farm is complete the agent drafts the pack from verified records only. The owner signs it off, and only then does it go to the certifier.\nThe checklist and the due date are settings: when the rules move, change them once and every open pack follows.');

  let at = laneBox(wf, 'chase', 4, 6, 'Mondays 08:00 NZ (or from the console): chase the evidence', 'Never messages the same person about the same item twice in 24 hours, and stops at three requests.');
  wf.add(schedule('Mondays 08:00', at(0, 0), { field: 'weeks', weeksInterval: 1, triggerAtDay: [1], triggerAtHour: 8 }));
  wf.add(calledBy('Run from console', at(0, 1)));
  wf.add(loadData('Load data (chase)', at(1, 0)));
  wf.add(code('Plan the chase', at(2, 0), src('plan-chase.code.js'), { prelude: PLAN_RULES }));
  wf.chain('Mondays 08:00', 'Load data (chase)', 'Plan the chase'); wf.link('Run from console', 'Load data (chase)');
  wf.add(splitOut('Request log', at(3, 0), 'updates')); wf.add(dtUpdate('Update evidence', at(4, 0), 'Evidence'));
  wf.add(splitOut('Requests and summaries', at(3, 1), 'messages')); wf.add(sendMessages('Send requests', at(4, 1)));
  wf.add(splitOut('Chase audit', at(3, 2), 'audit')); wf.add(dtInsert('Log the chase', at(4, 2), 'Audit log'));
  wf.add(code('Chase result', at(3, 3), RESULT));
  for (const n of ['Request log', 'Requests and summaries', 'Chase audit', 'Chase result']) wf.link('Plan the chase', n);
  wf.link('Request log', 'Update evidence'); wf.link('Requests and summaries', 'Send requests'); wf.link('Chase audit', 'Log the chase');

  at = laneBox(wf, 'form', 1, 4, 'Provider opens the upload link', 'From their phone: a PDF or a photo, no login.');
  wf.add(webhook(W, 'Provider opens upload link', at(0), 'GET', 'farmplan/upload'));
  wf.add(loadData('Load data (form)', at(1)));
  wf.add(code('Render upload page', at(2), src('plan-upload-form.code.js'), { webhook: 'Provider opens upload link' }));
  wf.add(respondHtml('Show upload page', at(3)));
  wf.chain('Provider opens upload link', 'Load data (form)', 'Render upload page', 'Show upload page');

  at = laneBox(wf, 'upload', 4, 7, 'Provider uploads the evidence', 'Stored under files/evidence and marked "check needed". The farm manager is asked to verify. Nothing is trusted until a person has looked at it.');
  wf.add(webhook(W, 'Provider uploads evidence', at(0, 0), 'POST', 'farmplan/upload'));
  wf.add(loadData('Load data (upload)', at(1, 0)));
  wf.add(code('Save upload', at(2, 0), src('plan-upload-save.code.js'), { webhook: 'Provider uploads evidence' }));
  wf.add(ifNotEmpty('File accepted?', at(3, 0), '$json.savePath'));
  wf.add(writeFile('Store evidence file', at(4, 0)));
  wf.chain('Provider uploads evidence', 'Load data (upload)', 'Save upload', 'File accepted?');
  wf.link('File accepted?', 'Store evidence file', 0);
  wf.add(splitOut('Received', at(5, 0), 'updates')); wf.add(dtUpdate('Mark received', at(6, 0), 'Evidence'));
  wf.add(splitOut('Verify request', at(5, 1), 'messages')); wf.add(sendMessages('Ask the manager to check', at(6, 1)));
  wf.add(splitOut('Upload audit', at(5, 2), 'audit')); wf.add(dtInsert('Log the upload', at(6, 2), 'Audit log'));
  wf.add(respondHtml('Show upload result', at(5, 3)));
  for (const n of ['Received', 'Verify request', 'Upload audit', 'Show upload result']) wf.link('Store evidence file', n);
  wf.link('File accepted?', 'Show upload result', 1);
  wf.link('Received', 'Mark received'); wf.link('Verify request', 'Ask the manager to check'); wf.link('Upload audit', 'Log the upload');

  at = laneBox(wf, 'verify', 5, 7, 'Farm manager verifies or sends back (console button)', 'Verified: when the last item on a farm is verified, the agent drafts the pack and asks the owner to sign. Sent back: the provider gets the reason and a fresh link.');
  wf.add(webhook(W, 'Manager verifies', at(0, 0), 'POST', 'farmplan/verify'));
  wf.add(loadData('Load data (verify)', at(1, 0)));
  wf.add(code('Verify or send back', at(2, 0), src('plan-verify.code.js'), { webhook: 'Manager verifies', prelude: PLAN_RULES }));
  wf.chain('Manager verifies', 'Load data (verify)', 'Verify or send back');
  wf.add(splitOut('Evidence decision', at(3, 0), 'updates')); wf.add(dtUpdate('Save evidence status', at(4, 0), 'Evidence'));
  wf.add(splitOut('Pack status', at(3, 1), 'farmUpdates')); wf.add(dtUpdate('Save pack status', at(4, 1), 'Farms'));
  wf.add(splitOut('Verify messages', at(3, 2), 'messages')); wf.add(sendMessages('Send the messages', at(4, 2)));
  wf.add(splitOut('Verify audit', at(3, 3), 'audit')); wf.add(dtInsert('Log the verification', at(4, 3), 'Audit log'));
  wf.add(respondRedirect('Back to the console', at(3, 4)));
  for (const n of ['Evidence decision', 'Pack status', 'Verify messages', 'Verify audit', 'Back to the console']) wf.link('Verify or send back', n);
  wf.link('Evidence decision', 'Save evidence status'); wf.link('Pack status', 'Save pack status'); wf.link('Verify messages', 'Send the messages'); wf.link('Verify audit', 'Log the verification');

  at = laneBox(wf, 'pack', 1, 4, 'Open the evidence pack (read-only)', 'The page the certifier gets a link to: every item, who supplied it, who verified it, and what happened.');
  wf.add(webhook(W, 'Open pack', at(0), 'GET', 'farmplan/pack'));
  wf.add(loadData('Load data (pack)', at(1)));
  wf.add(code('Render pack', at(2), src('plan-pack.code.js'), { webhook: 'Open pack', prelude: PLAN_RULES }));
  wf.add(respondHtml('Show pack', at(3)));
  wf.chain('Open pack', 'Load data (pack)', 'Render pack', 'Show pack');

  at = laneBox(wf, 'signoff-form', 1, 4, 'Owner opens the sign-off page', 'The pack, and a sign-off form that only appears once every item is verified.');
  wf.add(webhook(W, 'Owner opens sign-off', at(0), 'GET', 'farmplan/signoff'));
  wf.add(loadData('Load data (sign-off)', at(1)));
  wf.add(code('Render sign-off', at(2), src('plan-signoff-form.code.js'), { webhook: 'Owner opens sign-off', prelude: PLAN_RULES }));
  wf.add(respondHtml('Show sign-off', at(3)));
  wf.chain('Owner opens sign-off', 'Load data (sign-off)', 'Render sign-off', 'Show sign-off');

  at = laneBox(wf, 'signoff-save', 4, 6, 'Owner signs off: only now does anything go to the certifier', 'Needs the owner\'s full name and a confirmation. The email to the certifier, and the record of who signed and when, happen after this click and not before.');
  wf.add(webhook(W, 'Owner signs off', at(0, 0), 'POST', 'farmplan/signoff'));
  wf.add(loadData('Load data (sign)', at(1, 0)));
  wf.add(code('Record sign-off', at(2, 0), src('plan-signoff-save.code.js'), { webhook: 'Owner signs off', prelude: PLAN_RULES }));
  wf.chain('Owner signs off', 'Load data (sign)', 'Record sign-off');
  wf.add(splitOut('Pack signed', at(3, 0), 'farmUpdates')); wf.add(dtUpdate('Save sign-off', at(4, 0), 'Farms'));
  wf.add(splitOut('Certifier email', at(3, 1), 'messages')); wf.add(sendMessages('Email the certifier', at(4, 1)));
  wf.add(splitOut('Sign-off audit', at(3, 2), 'audit')); wf.add(dtInsert('Log the sign-off', at(4, 2), 'Audit log'));
  wf.add(respondHtml('Show sign-off result', at(3, 3)));
  for (const n of ['Pack signed', 'Certifier email', 'Sign-off audit', 'Show sign-off result']) wf.link('Record sign-off', n);
  wf.link('Pack signed', 'Save sign-off'); wf.link('Certifier email', 'Email the certifier'); wf.link('Sign-off audit', 'Log the sign-off');

  at = laneBox(wf, 'file', 2, 6, 'View an uploaded evidence file', 'The pack token proves the file belongs to that pack.');
  wf.add(webhook(W, 'View evidence file', at(0, 0), 'GET', 'farmplan/file'));
  wf.add(loadData('Load data (file)', at(1, 0)));
  wf.add(code('Locate file', at(2, 0), SMALL.EVIDENCE_FILE, { webhook: 'View evidence file' }));
  wf.add(ifEquals('File on record?', at(3, 0), '$json.ok', 'true'));
  wf.add(readFile('Read evidence file', at(4, 0)));
  wf.add(respondFile('Show file', at(5, 0), 'inline'));
  wf.add(respondHtml('No file page', at(4, 1)));
  wf.chain('View evidence file', 'Load data (file)', 'Locate file', 'File on record?');
  wf.link('File on record?', 'Read evidence file', 0); wf.link('File on record?', 'No file page', 1);
  wf.link('Read evidence file', 'Show file');

  at = laneBox(wf, 'rule', 6, 7, 'The checklist changes: add a requirement (console form)', 'It becomes an open item on every farm it applies to, and any pack that was ready or already sent is reopened. Nothing is lost: every earlier record stays.');
  wf.add(webhook(W, 'Add a requirement', at(0, 0), 'POST', 'farmplan/rule'));
  wf.add(loadData('Load data (rule)', at(1, 0)));
  wf.add(code('Add the requirement', at(2, 0), src('plan-rule-add.code.js'), { webhook: 'Add a requirement' }));
  wf.chain('Add a requirement', 'Load data (rule)', 'Add the requirement');
  wf.add(splitOut('New requirement', at(3, 0), 'reqInserts')); wf.add(dtInsert('Add to the checklist', at(4, 0), 'Requirements'));
  wf.add(splitOut('New evidence items', at(3, 1), 'evidenceInserts')); wf.add(dtInsert('Open items on each farm', at(4, 1), 'Evidence'));
  wf.add(splitOut('Reopened packs', at(3, 2), 'farmUpdates')); wf.add(dtUpdate('Reopen the packs', at(4, 2), 'Farms'));
  wf.add(splitOut('Checklist messages', at(3, 3), 'messages')); wf.add(sendMessages('Tell the owner', at(4, 3)));
  wf.add(splitOut('Checklist audit', at(3, 4), 'audit')); wf.add(dtInsert('Log the change', at(4, 4), 'Audit log'));
  wf.add(respondRedirect('Back to the console (rule)', at(3, 5)));
  for (const n of ['New requirement', 'New evidence items', 'Reopened packs', 'Checklist messages', 'Checklist audit', 'Back to the console (rule)']) wf.link('Add the requirement', n);
  wf.link('New requirement', 'Add to the checklist'); wf.link('New evidence items', 'Open items on each farm'); wf.link('Reopened packs', 'Reopen the packs');
  wf.link('Checklist messages', 'Tell the owner'); wf.link('Checklist audit', 'Log the change');

  at = laneBox(wf, 'deadline', 3, 5, 'The due date moves (console form)', 'One setting. Every countdown, message and pack uses it.');
  wf.add(webhook(W, 'Change the due date', at(0, 0), 'POST', 'farmplan/deadline'));
  wf.add(loadData('Load data (due date)', at(1, 0)));
  wf.add(code('Save the due date', at(2, 0), src('plan-rule-deadline.code.js'), { webhook: 'Change the due date' }));
  wf.chain('Change the due date', 'Load data (due date)', 'Save the due date');
  wf.add(splitOut('Setting change', at(3, 0), 'configUpdates')); wf.add(dtUpdate('Update the setting', at(4, 0), 'Config'));
  wf.add(splitOut('Due date audit', at(3, 1), 'audit')); wf.add(dtInsert('Log the due date change', at(4, 1), 'Audit log'));
  wf.add(respondRedirect('Back to the console (due date)', at(3, 2)));
  for (const n of ['Setting change', 'Due date audit', 'Back to the console (due date)']) wf.link('Save the due date', n);
  wf.link('Setting change', 'Update the setting'); wf.link('Due date audit', 'Log the due date change');
  write(wf);
}

// ================================================================ 3 · Consents and certificates
{
  const W = IDS.REGISTER;
  const wf = workflow(W, '3 · Consents and certificates: watch → remind → verify', 'Watches every consent, certificate, vehicle check and insurance date, reminds the person responsible on a tightening schedule, flags what not to assign, and lets a person verify each renewal.');
  header(wf, -200, '3 · Consents and certificates: watch → remind → verify', 'Daily: work out where every record stands. Consent renewals follow the renewal timing in section 124 of the Resource Management Act (the months are settings, because the rules are being changed). Certificates, vehicle checks and insurance use 30-day and 7-day warnings.\nReminders get closer together as the date nears. Expired or missing records tell the operations manager what not to assign until a person has sorted it.');

  let at = laneBox(wf, 'watch', 4, 6, 'Daily 07:00 NZ (or from the console): watch the register', 'One summary to the admin, one "do not assign" alert to the operations manager, and a reminder to each person responsible.');
  wf.add(schedule('Every day 07:00', at(0, 0), { field: 'days', daysInterval: 1, triggerAtHour: 7 }));
  wf.add(calledBy('Run from console', at(0, 1)));
  wf.add(loadData('Load data (watch)', at(1, 0)));
  wf.add(code('Watch the register', at(2, 0), src('watch-check.code.js'), { prelude: REGISTER_RULES }));
  wf.chain('Every day 07:00', 'Load data (watch)', 'Watch the register'); wf.link('Run from console', 'Load data (watch)');
  wf.add(splitOut('Reminder log', at(3, 0), 'updates')); wf.add(dtUpdate('Update register', at(4, 0), 'Register'));
  wf.add(splitOut('Reminders and alerts', at(3, 1), 'messages')); wf.add(sendMessages('Send reminders and alerts', at(4, 1)));
  wf.add(splitOut('Watch audit', at(3, 2), 'audit')); wf.add(dtInsert('Log the watch', at(4, 2), 'Audit log'));
  wf.add(code('Watch result', at(3, 3), RESULT));
  for (const n of ['Reminder log', 'Reminders and alerts', 'Watch audit', 'Watch result']) wf.link('Watch the register', n);
  wf.link('Reminder log', 'Update register'); wf.link('Reminders and alerts', 'Send reminders and alerts'); wf.link('Watch audit', 'Log the watch');

  at = laneBox(wf, 'form', 1, 4, 'Person opens the upload link', 'A photo or PDF of the renewal, and its new expiry date.');
  wf.add(webhook(W, 'Person opens upload link', at(0), 'GET', 'register/upload'));
  wf.add(loadData('Load data (form)', at(1)));
  wf.add(code('Render upload page', at(2), src('watch-upload-form.code.js'), { webhook: 'Person opens upload link', prelude: REGISTER_RULES }));
  wf.add(respondHtml('Show upload page', at(3)));
  wf.chain('Person opens upload link', 'Load data (form)', 'Render upload page', 'Show upload page');

  at = laneBox(wf, 'upload', 4, 7, 'Person uploads the renewal', 'Stored under files/register. The register keeps the old expiry date until a person has verified the upload.');
  wf.add(webhook(W, 'Person uploads renewal', at(0, 0), 'POST', 'register/upload'));
  wf.add(loadData('Load data (upload)', at(1, 0)));
  wf.add(code('Save upload', at(2, 0), src('watch-upload-save.code.js'), { webhook: 'Person uploads renewal' }));
  wf.add(ifNotEmpty('File accepted?', at(3, 0), '$json.savePath'));
  wf.add(writeFile('Store document', at(4, 0)));
  wf.chain('Person uploads renewal', 'Load data (upload)', 'Save upload', 'File accepted?');
  wf.link('File accepted?', 'Store document', 0);
  wf.add(splitOut('Received', at(5, 0), 'updates')); wf.add(dtUpdate('Mark received', at(6, 0), 'Register'));
  wf.add(splitOut('Verify request', at(5, 1), 'messages')); wf.add(sendMessages('Ask the admin to verify', at(6, 1)));
  wf.add(splitOut('Upload audit', at(5, 2), 'audit')); wf.add(dtInsert('Log the upload', at(6, 2), 'Audit log'));
  wf.add(respondHtml('Show upload result', at(5, 3)));
  for (const n of ['Received', 'Verify request', 'Upload audit', 'Show upload result']) wf.link('Store document', n);
  wf.link('File accepted?', 'Show upload result', 1);
  wf.link('Received', 'Mark received'); wf.link('Verify request', 'Ask the admin to verify'); wf.link('Upload audit', 'Log the upload');

  at = laneBox(wf, 'verify', 4, 6, 'Admin verifies or sends back (console button)', 'Verified: the register takes the new expiry date and the reminders stop. Sent back: the person gets the reason and a fresh link.');
  wf.add(webhook(W, 'Admin verifies', at(0, 0), 'POST', 'register/verify'));
  wf.add(loadData('Load data (verify)', at(1, 0)));
  wf.add(code('Verify or send back', at(2, 0), src('watch-verify.code.js'), { webhook: 'Admin verifies', prelude: REGISTER_RULES }));
  wf.chain('Admin verifies', 'Load data (verify)', 'Verify or send back');
  wf.add(splitOut('Verify decision', at(3, 0), 'updates')); wf.add(dtUpdate('Save the record', at(4, 0), 'Register'));
  wf.add(splitOut('Verify messages', at(3, 1), 'messages')); wf.add(sendMessages('Send the messages', at(4, 1)));
  wf.add(splitOut('Verify audit', at(3, 2), 'audit')); wf.add(dtInsert('Log the verification', at(4, 2), 'Audit log'));
  wf.add(respondRedirect('Back to the console', at(3, 3)));
  for (const n of ['Verify decision', 'Verify messages', 'Verify audit', 'Back to the console']) wf.link('Verify or send back', n);
  wf.link('Verify decision', 'Save the record'); wf.link('Verify messages', 'Send the messages'); wf.link('Verify audit', 'Log the verification');

  at = laneBox(wf, 'lodged', 3, 6, 'Owner records that a consent renewal was lodged (console button)', 'The agent then explains what that means for operating while the council decides: as of right, at the council\'s discretion, or not at all.');
  wf.add(webhook(W, 'Owner records lodged renewal', at(0, 0), 'POST', 'register/lodged'));
  wf.add(loadData('Load data (lodged)', at(1, 0)));
  wf.add(code('Record the renewal', at(2, 0), src('watch-lodged.code.js'), { webhook: 'Owner records lodged renewal', prelude: REGISTER_RULES }));
  wf.chain('Owner records lodged renewal', 'Load data (lodged)', 'Record the renewal');
  wf.add(splitOut('Lodged record', at(3, 0), 'updates')); wf.add(dtUpdate('Save lodged date', at(4, 0), 'Register'));
  wf.add(splitOut('Lodged audit', at(3, 1), 'audit')); wf.add(dtInsert('Log the lodged renewal', at(4, 1), 'Audit log'));
  wf.add(respondRedirect('Back to the console (lodged)', at(3, 2)));
  for (const n of ['Lodged record', 'Lodged audit', 'Back to the console (lodged)']) wf.link('Record the renewal', n);
  wf.link('Lodged record', 'Save lodged date'); wf.link('Lodged audit', 'Log the lodged renewal');

  at = laneBox(wf, 'file', 2, 6, 'View an uploaded certificate or consent', 'Opens the stored photo or PDF.');
  wf.add(webhook(W, 'View register file', at(0, 0), 'GET', 'register/file'));
  wf.add(loadData('Load data (file)', at(1, 0)));
  wf.add(code('Locate file', at(2, 0), SMALL.REGISTER_FILE, { webhook: 'View register file' }));
  wf.add(ifEquals('File on record?', at(3, 0), '$json.ok', 'true'));
  wf.add(readFile('Read document', at(4, 0)));
  wf.add(respondFile('Show file', at(5, 0), 'inline'));
  wf.add(respondHtml('No file page', at(4, 1)));
  wf.chain('View register file', 'Load data (file)', 'Locate file', 'File on record?');
  wf.link('File on record?', 'Read document', 0); wf.link('File on record?', 'No file page', 1);
  wf.link('Read document', 'Show file');
  write(wf);
}

// ================================================================ Demo console
{
  const W = IDS.CONSOLE;
  const wf = workflow(W, 'Demo console', 'The web page used in demos: what is waiting for a person, supplier invoices, farm plan evidence, consents and certificates, the audit trail and messages, with buttons to run each automation.');
  header(wf, -200, 'Demo console', `Open **${BASE_URL}/webhook/console** in a browser. The buttons run the three automations through their "Run from console" triggers.`, 1500);
  let at = laneBox(wf, 'view', 1, 4, 'Show the console', 'Reads all the records and renders the page, one tab at a time.');
  const consolePrelude = join(`const CONSOLE_CSS = ${JSON.stringify(src('console.css'))};`, INVOICE_RULES, REGISTER_RULES, PLAN_RULES);
  wf.add(webhook(W, 'Open console', at(0), 'GET', 'console'));
  wf.add(loadData('Load data', at(1)));
  wf.add(code('Render console', at(2), src('console.code.js'), { webhook: 'Open console', prelude: consolePrelude }));
  wf.add(respondHtml('Show console', at(3)));
  wf.chain('Open console', 'Load data', 'Render console', 'Show console');

  const ids = { WF_INVOICES: IDS.INVOICES, WF_PLAN: IDS.PLAN, WF_REGISTER: IDS.REGISTER, WF_RESET: IDS.RESET };
  at = laneBox(wf, 'buttons', 2, 6, 'Console buttons', 'Runs the chosen automation, then returns to the console with its summary.');
  wf.add(webhook(W, 'Console button', at(0, 0), 'POST', 'console/run'));
  wf.add(code('Choose automation', at(1, 0), SMALL.CONSOLE_RUN, { webhook: 'Console button', prelude: `const WORKFLOW_IDS = ${JSON.stringify(ids)};` }));
  wf.add(ifEquals('Known action?', at(2, 0), '$json.valid', 'true'));
  wf.add(N('Run automation', 'n8n-nodes-base.executeWorkflow', 1.1, at(3, 0), { source: 'database', workflowId: { __rl: true, mode: 'id', value: '={{ $json.workflowId }}' }, mode: 'once', options: { waitForSubWorkflow: true } }));
  wf.add(code('Back to console', at(4, 0), SMALL.CONSOLE_DONE, { prelude: `const BASE_URL = ${JSON.stringify(BASE_URL)};` }));
  wf.add(respondRedirect('Redirect', at(5, 0)));
  wf.chain('Console button', 'Choose automation', 'Known action?');
  wf.link('Known action?', 'Run automation', 0);
  wf.link('Known action?', 'Back to console', 1);
  wf.chain('Run automation', 'Back to console', 'Redirect');

  at = laneBox(wf, 'audit-csv', 1, 4, 'Download the audit trail', 'Every step the agent and the people took, as a CSV file.');
  wf.add(webhook(W, 'Download audit trail', at(0), 'GET', 'audit/csv'));
  wf.add(loadData('Load data (audit)', at(1)));
  wf.add(code('Build audit CSV', at(2), SMALL.AUDIT_CSV, { webhook: 'Download audit trail' }));
  wf.add(respondFile('Send audit CSV', at(3), 'attachment'));
  wf.chain('Download audit trail', 'Load data (audit)', 'Build audit CSV', 'Send audit CSV');
  write(wf);
}

console.log(`Built ${fs.readdirSync(OUT).filter((f) => f.endsWith('.json')).length} workflows in ${OUT}`);
