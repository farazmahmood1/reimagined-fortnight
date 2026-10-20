// Generates the n8n workflow files in ./workflows from the logic in ./src.
// Run: node scripts/build-workflows.mjs   (setup.mjs runs it for you)
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { ROOT, FILES_DIR, BASE_URL } from './env.mjs';
import * as DEMO from './demo-data.mjs';
import * as SMALL from '../src/small-handlers.mjs';
import * as INBOX from '../src/inbox-defaults.mjs';
import * as INBOX_SMALL from '../src/inbox-handlers.mjs';
import { createRequire } from 'node:module';

const OUT = path.join(ROOT, 'workflows');
fs.mkdirSync(OUT, { recursive: true });
const FILES = FILES_DIR.replace(/\\/g, '/');
const SHARED = fs.readFileSync(path.join(ROOT, 'src', 'shared.js'), 'utf8');
const src = (file) => fs.readFileSync(path.join(ROOT, 'src', file), 'utf8');

export const IDS = {
  LOAD: 'frfLoadData00001', SEND: 'frfSendMessage01', RESET: 'frfResetDemo0001',
  TIMESHEETS: 'frfTimesheets001', DOCUMENTS: 'frfDocuments0001', UMBRELLA: 'frfUmbrella00001', CONSOLE: 'frfConsole000001',
  TRIAGE: 'frfInboxTriage01',
};
// Inbox triage tables. Kept out of TABLES so "Reset demo data" and "Load data" never touch them.
export const TRIAGE_TABLES = {
  Applications: [['app_id', 'string'], ['message_id', 'string'], ['received_at', 'string'], ['from_name', 'string'], ['from_email', 'string'], ['subject', 'string'], ['role', 'string'], ['role_source', 'string'], ['detect_reason', 'string'], ['cover_text', 'string'], ['cv_file', 'string'], ['cv_original_name', 'string'], ['cv_chars', 'number'], ['cv_text', 'string'], ['cv_note', 'string'], ['ai_status', 'string'], ['ai_error', 'string'], ['ai_at', 'string'], ['ai_model', 'string'], ['ai_tokens', 'number'], ['ai_summary', 'string'], ['ai_current_title', 'string'], ['ai_experience', 'string'], ['ai_location', 'string'], ['ai_availability', 'string'], ['ai_role_guess', 'string'], ['ai_must_haves', 'string'], ['ai_nice_to_haves', 'string'], ['ai_questions', 'string'], ['decision', 'string'], ['decided_at', 'string'], ['found_at', 'string']],
  'Triage roles': [['role', 'string'], ['keywords', 'string'], ['must_haves', 'string'], ['nice_to_haves', 'string']],
  'Triage settings': [['key', 'string'], ['value', 'string']],
};
// The inbox reader's first run only goes back this far.
const INBOX_SINCE = '2026-06-01';
const INBOX_SHARED = fs.readFileSync(path.join(ROOT, 'src', 'inbox-shared.js'), 'utf8');
// Saved n8n credentials, found by type so the workflow file never holds a secret (ids and names only).
const CREDENTIALS = await (async () => {
  try {
    const sqlite3 = createRequire(import.meta.url)('sqlite3');
    const db = new sqlite3.Database(path.join(ROOT, 'data', '.n8n', 'database.sqlite'), sqlite3.OPEN_READONLY);
    const all = (sql) => new Promise((resolve, reject) => db.all(sql, (e, r) => (e ? reject(e) : resolve(r))));
    const rows = await all("SELECT id, name, type FROM credentials_entity WHERE type IN ('imap', 'openAiApi') ORDER BY createdAt");
    const wf = await all("SELECT staticData FROM workflow_entity WHERE id = 'frfInboxTriage01'");
    db.close();
    return { ...Object.fromEntries(rows.map((r) => [r.type, { id: r.id, name: r.name }])), staticData: wf[0] && wf[0].staticData ? JSON.parse(wf[0].staticData) : null };
  } catch { return {}; }
})();
if (!CREDENTIALS.imap) console.warn('! No IMAP credential found in n8n: add one, then run setup again.');
if (!CREDENTIALS.openAiApi) console.warn('! No OpenAI credential found in n8n: AI summaries will not work until you add one.');
export const TABLES = {
  Config: [['key', 'string'], ['value', 'string']],
  Clients: [['client_id', 'string'], ['name', 'string'], ['site', 'string'], ['manager_name', 'string'], ['manager_email', 'string'], ['manager_phone', 'string']],
  Umbrellas: [['umbrella_id', 'string'], ['name', 'string'], ['contact_name', 'string'], ['contact_email', 'string']],
  Temps: [['temp_id', 'string'], ['first_name', 'string'], ['last_name', 'string'], ['phone', 'string'], ['email', 'string'], ['client_id', 'string'], ['role', 'string'], ['pay_route', 'string'], ['pay_rate', 'number'], ['charge_rate', 'number'], ['compliance_status', 'string'], ['compliance_checked_at', 'string']],
  Timesheets: [['timesheet_id', 'string'], ['week_ending', 'string'], ['temp_id', 'string'], ['client_id', 'string'], ['hours', 'number'], ['daily_breakdown', 'string'], ['notes', 'string'], ['status', 'string'], ['submit_token', 'string'], ['approve_token', 'string'], ['submitted_at', 'string'], ['approved_at', 'string'], ['approved_by', 'string'], ['reminders_sent', 'number'], ['last_reminder_at', 'string'], ['exported_at', 'string'], ['export_file', 'string'], ['queried_at', 'string']],
  Documents: [['doc_id', 'string'], ['temp_id', 'string'], ['doc_type', 'string'], ['status', 'string'], ['expiry_date', 'string'], ['upload_token', 'string'], ['file_name', 'string'], ['original_name', 'string'], ['received_at', 'string'], ['reminders_sent', 'number'], ['last_reminder_at', 'string'], ['verified_at', 'string'], ['verified_by', 'string']],
  Evidence: [['evidence_id', 'string'], ['umbrella_id', 'string'], ['period', 'string'], ['status', 'string'], ['upload_token', 'string'], ['requested_at', 'string'], ['received_at', 'string'], ['reminders_sent', 'number'], ['last_reminder_at', 'string'], ['file_name', 'string'], ['lines', 'number'], ['flags', 'number']],
  'Payslip checks': [['evidence_id', 'string'], ['umbrella_id', 'string'], ['period', 'string'], ['temp_id', 'string'], ['worker_name', 'string'], ['hours', 'number'], ['approved_hours', 'number'], ['expected_income', 'number'], ['assignment_income', 'number'], ['gross_taxable_pay', 'number'], ['gross_per_hour', 'number'], ['non_taxable_payments', 'number'], ['result', 'string'], ['reasons', 'string'], ['checked_at', 'string']],
  Outbox: [['created_at', 'string'], ['channel', 'string'], ['to_name', 'string'], ['to_address', 'string'], ['subject', 'string'], ['body', 'string'], ['link', 'string'], ['related', 'string'], ['workflow', 'string'], ['delivery', 'string']],
  Exports: [['file_name', 'string'], ['week_ending', 'string'], ['rows', 'number'], ['pay_total', 'number'], ['invoice_total', 'number'], ['created_at', 'string']],
};
const TABLE_NAMES = Object.keys(TABLES);

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
    settings: { executionOrder: 'v1', timezone: 'Europe/London', saveDataSuccessExecution: 'all', saveManualExecutions: true, callerPolicy: 'workflowsFromSameOwner' },
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
  const wf = workflow(IDS.LOAD, 'Shared · Load data', 'Reads every data table once and returns one item with an array per table. Stands in for the agency ATS and payroll API.');
  wf.add(note('About', [-40, 80], '## Shared · Load data\nReads the agency data in one go so each automation starts with a complete picture.\n\nIn a live agency this is where the ATS / payroll API calls go.', 520, 150, 5));
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
  wf.add(note('About', [-40, 40], '## Shared · Send message\nEvery automation hands its texts and emails to this workflow.\n\n**Demo mode:** messages are logged to the Outbox table only.\n**Live:** add Twilio and SMTP credentials, enable the two grey nodes, then set `sms_enabled` / `email_enabled` to `true` in the Config table.', 560, 190, 5));
  wf.add(calledBy('When called by a workflow', [0, 320]));
  wf.add(dtGet('Config', [220, 320]));
  wf.add(code('Prepare messages', [440, 320], `const cfg = configFromRows($('Config').all().map((i) => i.json));
function configFromRows(rows) { return Object.fromEntries(rows.filter((r) => r && r.key).map((r) => [r.key, r.value])); }
const live = (channel) => (channel === 'SMS' ? cfg.sms_enabled : cfg.email_enabled) === 'true';
const msgs = $('When called by a workflow').all().map((i) => i.json).filter((m) => m && m.to_address && m.body);
return msgs.map((m, i) => ({ json: {
  created_at: new Date(Date.now() + i).toISOString(), channel: m.channel, to_name: m.to_name || '', to_address: m.to_address,
  subject: m.subject || '', body: m.body, link: m.link || '', related: m.related || '', workflow: m.workflow || '',
  delivery: live(m.channel) ? (m.channel === 'SMS' ? 'Sent by SMS (Twilio)' : 'Sent by email (SMTP)') : 'Demo mode: logged, not sent',
} }));`));
  wf.add(dtInsert('Log to Outbox', [660, 320], 'Outbox'));
  wf.add(code('SMS to send', [880, 200], `return $input.all().filter((i) => i.json.channel === 'SMS' && String(i.json.delivery).startsWith('Sent'));`));
  wf.add(N('Send SMS (Twilio)', 'n8n-nodes-base.twilio', 1, [1100, 200], { resource: 'sms', operation: 'send', from: '+447700900000', to: '={{ $json.to_address }}', message: "={{ $json.body }}{{ $json.link ? ' ' + $json.link : '' }}", options: {} }, { disabled: true, notes: 'Add your Twilio credential and sender number, then enable.' }));
  wf.add(code('Emails to send', [880, 420], `return $input.all().filter((i) => i.json.channel === 'Email' && String(i.json.delivery).startsWith('Sent'));`));
  wf.add(N('Send email (SMTP)', 'n8n-nodes-base.emailSend', 2.1, [1100, 420], { operation: 'send', fromEmail: 'automations@harbourline.example', toEmail: '={{ $json.to_address }}', subject: '={{ $json.subject }}', emailFormat: 'text', text: "={{ $json.body }}\n\n{{ $json.link }}", options: { appendAttribution: false } }, { disabled: true, notes: 'Add your SMTP credential and sender address, then enable.' }));
  wf.add(code('Done', [880, 600], `return [{ json: { summary: \`Logged \${$('Log to Outbox').all().length} message(s).\` } }];`));
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
  wf.add(note('About', [-40, 60], '## Demo · Reset data\nCreates the data tables (first run), clears them and loads the fictional Harbourline Recruitment data: a Monday morning with missing timesheets, expiring documents and umbrella evidence due.', 600, 160, 5));
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
  const demo = { CONFIG: DEMO.CONFIG, CLIENTS: DEMO.CLIENTS, UMBRELLAS: DEMO.UMBRELLAS, TEMPS: DEMO.TEMPS, TIMESHEETS_THIS_WEEK: DEMO.TIMESHEETS_THIS_WEEK, LAST_MONTH_HOURS: DEMO.LAST_MONTH_HOURS, DOCUMENTS: DEMO.DOCUMENTS };
  wf.add(code('Build demo data', [220 + TABLE_NAMES.length * 180, 520], src('reset.code.js'), { prelude: `const DEMO_DATA = ${JSON.stringify(demo)};` }));
  wf.link(prev, 'Build demo data');
  const seeded = ['Config', 'Clients', 'Umbrellas', 'Temps', 'Timesheets', 'Documents'];
  const x = 220 + (TABLE_NAMES.length + 1) * 180;
  seeded.forEach((t, i) => {
    wf.add(splitOut(`Rows: ${t}`, [x, 300 + i * 150], t));
    wf.add(dtInsert(`Insert ${t}`, [x + 220, 300 + i * 150], t));
    wf.link('Build demo data', `Rows: ${t}`);
    wf.link(`Rows: ${t}`, `Insert ${t}`);
  });
  wf.add(code('Done', [x, 300 + seeded.length * 150], `return [{ json: { summary: $('Build demo data').first().json.summary } }];`));
  wf.link('Build demo data', 'Done');
  write(wf);
}

// ================================================================ lane layout helpers
// Each lane is a grey box (sticky note) holding one trigger and its flow, left to right.
// Rows inside a lane are 140 px apart; parallel branches run top-to-bottom, which is also
// n8n's execution order, so write-backs happen before the page/summary is returned.
const COL = 200;
const ROW = 140;
let laneY = 0;
function laneBox(wf, key, rows, cols, title, text, color = 7) {
  const y = laneY;
  laneY += 80 + rows * ROW + 40; // box height + gap to the next lane
  wf.add(note(`Lane: ${key}`, [-70, y], `### ${title}\n${text}`, cols * COL + 120, 80 + rows * ROW, color));
  return (col, row = 0) => [col * COL, y + 80 + row * ROW];
}
function header(wf, y, title, text, width = 1700) {
  wf.add(note('About this workflow', [-70, y], `## ${title}\n${text}`, width, 140, 5));
  laneY = y + 180;
}

// ================================================================ 1 · Timesheets
{
  const W = IDS.TIMESHEETS;
  const wf = workflow(W, '1 · Timesheets: chase → approve → payroll export', 'Chases missing timesheets by SMS, takes hours from a mobile form, gets one-click client approval and exports approved hours for payroll.');
  header(wf, -200, '1 · Timesheets: chase → approve → payroll export', 'Monday: text every temp with a missing timesheet. Temp submits hours on a mobile form → client manager approves in one click → temp gets a text. Friday: approved hours → payroll and invoicing CSV.\nIn a live agency, "Load data" and the update nodes talk to the ATS and payroll instead of the demo tables.');

  // Console lane (top): routes to the chase or export lanes below.
  let at = laneBox(wf, 'console', 1, 2, 'Run from the demo console', 'The console sends run = chase or export.');
  wf.add(calledBy('Run from console', at(0)));
  wf.add(ifEquals('Export or chase?', at(1), '$json.run', 'export'));
  wf.link('Run from console', 'Export or chase?');

  at = laneBox(wf, 'chase', 3, 6, 'Monday 09:00: chase missing timesheets', 'Texts each temp a secure link, reminds client managers to approve, emails the consultant a summary.');
  wf.add(schedule('Every Monday 09:00', at(0, 0), { field: 'weeks', weeksInterval: 1, triggerAtDay: [1], triggerAtHour: 9 }));
  wf.add(loadData('Load data (chase)', at(1, 0)));
  wf.add(code('Plan chase', at(2, 0), src('timesheet-chase.code.js')));
  wf.add(splitOut('Reminder counts', at(3, 0), 'updates'));
  wf.add(dtUpdate('Update timesheets', at(4, 0), 'Timesheets'));
  wf.add(splitOut('Chase messages', at(3, 1), 'messages'));
  wf.add(sendMessages('Send chase messages', at(4, 1)));
  wf.add(code('Chase result', at(3, 2), RESULT));
  wf.chain('Every Monday 09:00', 'Load data (chase)', 'Plan chase');
  for (const n of ['Reminder counts', 'Chase messages', 'Chase result']) wf.link('Plan chase', n);
  wf.link('Reminder counts', 'Update timesheets');
  wf.link('Chase messages', 'Send chase messages');
  wf.link('Export or chase?', 'Load data (chase)', 1);

  at = laneBox(wf, 'export', 4, 7, 'Friday 12:00: payroll export', 'Approved hours → CSV with pay, charge and margin per worker (PAYE or umbrella), saved to files/payroll-exports.');
  wf.add(schedule('Every Friday 12:00', at(0, 0), { field: 'weeks', weeksInterval: 1, triggerAtDay: [5], triggerAtHour: 12 }));
  wf.add(loadData('Load data (export)', at(1, 0)));
  wf.add(code('Build payroll CSV', at(2, 0), src('payroll-export.code.js')));
  wf.add(ifNotEmpty('Anything to export?', at(3, 0), '$json.fileName'));
  wf.add(N('Save CSV to files', 'n8n-nodes-base.readWriteFile', 1, at(4, 0), { operation: 'write', fileName: `=${FILES}/payroll-exports/{{ $json.fileName }}`, dataPropertyName: 'data', options: {} }));
  wf.add(splitOut('Exported timesheets', at(5, 0), 'updates'));
  wf.add(dtUpdate('Mark as exported', at(6, 0), 'Timesheets'));
  wf.add(splitOut('Export record', at(5, 1), 'exportRecords'));
  wf.add(dtInsert('Record export', at(6, 1), 'Exports'));
  wf.add(splitOut('Payroll email', at(5, 2), 'messages'));
  wf.add(sendMessages('Send payroll email', at(6, 2)));
  wf.add(code('Export result', at(5, 3), RESULT));
  wf.chain('Every Friday 12:00', 'Load data (export)', 'Build payroll CSV', 'Anything to export?');
  wf.link('Anything to export?', 'Save CSV to files', 0);
  wf.link('Anything to export?', 'Export result', 1);
  for (const n of ['Exported timesheets', 'Export record', 'Payroll email', 'Export result']) wf.link('Save CSV to files', n);
  wf.link('Exported timesheets', 'Mark as exported');
  wf.link('Export record', 'Record export');
  wf.link('Payroll email', 'Send payroll email');
  wf.link('Export or chase?', 'Load data (export)', 0);

  at = laneBox(wf, 'form', 1, 4, 'Temp opens the SMS link', 'Mobile form with hours per day.');
  wf.add(webhook(W, 'Temp opens timesheet link', at(0), 'GET', 'timesheet'));
  wf.add(loadData('Load data (form)', at(1)));
  wf.add(code('Render timesheet form', at(2), src('timesheet-form.code.js'), { webhook: 'Temp opens timesheet link' }));
  wf.add(respondHtml('Show form', at(3)));
  wf.chain('Temp opens timesheet link', 'Load data (form)', 'Render timesheet form', 'Show form');

  at = laneBox(wf, 'submit', 3, 6, 'Temp submits hours', 'Saves the hours, emails the client manager a one-click approval link, shows the temp a confirmation.');
  wf.add(webhook(W, 'Temp submits hours', at(0, 0), 'POST', 'timesheet'));
  wf.add(loadData('Load data (submit)', at(1, 0)));
  wf.add(code('Save hours', at(2, 0), src('timesheet-submit.code.js'), { webhook: 'Temp submits hours' }));
  wf.add(splitOut('Submitted hours', at(3, 0), 'updates'));
  wf.add(dtUpdate('Update timesheet', at(4, 0), 'Timesheets'));
  wf.add(splitOut('Approval request', at(3, 1), 'messages'));
  wf.add(sendMessages('Email client manager', at(4, 1)));
  wf.add(respondHtml('Show confirmation', at(3, 2)));
  wf.chain('Temp submits hours', 'Load data (submit)', 'Save hours');
  for (const n of ['Submitted hours', 'Approval request', 'Show confirmation']) wf.link('Save hours', n);
  wf.link('Submitted hours', 'Update timesheet');
  wf.link('Approval request', 'Email client manager');

  at = laneBox(wf, 'approve', 3, 6, 'Client manager approves or queries', 'Approve → temp gets a text. Query → consultant gets an alert and the temp can resubmit.');
  wf.add(webhook(W, 'Client opens approval link', at(0, 0), 'GET', 'timesheet/approve'));
  wf.add(loadData('Load data (approve)', at(1, 0)));
  wf.add(code('Approve or query', at(2, 0), src('timesheet-approve.code.js'), { webhook: 'Client opens approval link' }));
  wf.add(splitOut('Decision', at(3, 0), 'updates'));
  wf.add(dtUpdate('Save decision', at(4, 0), 'Timesheets'));
  wf.add(splitOut('Notify', at(3, 1), 'messages'));
  wf.add(sendMessages('Text temp or alert consultant', at(4, 1)));
  wf.add(respondHtml('Show approval page', at(3, 2)));
  wf.chain('Client opens approval link', 'Load data (approve)', 'Approve or query');
  for (const n of ['Decision', 'Notify', 'Show approval page']) wf.link('Approve or query', n);
  wf.link('Decision', 'Save decision');
  wf.link('Notify', 'Text temp or alert consultant');

  at = laneBox(wf, 'download', 2, 5, 'Download a payroll CSV', 'Only exact export file names are accepted.');
  wf.add(webhook(W, 'Download payroll CSV', at(0, 0), 'GET', 'payroll/file'));
  wf.add(code('Check file name', at(1, 0), SMALL.PAYROLL_FILE, { webhook: 'Download payroll CSV' }));
  wf.add(ifEquals('File name valid?', at(2, 0), '$json.ok', 'true'));
  wf.add(readFile('Read CSV file', at(3, 0)));
  wf.add(respondFile('Send CSV', at(4, 0), 'attachment'));
  wf.add(respondHtml('Not found page', at(3, 1)));
  wf.chain('Download payroll CSV', 'Check file name', 'File name valid?');
  wf.link('File name valid?', 'Read CSV file', 0);
  wf.link('File name valid?', 'Not found page', 1);
  wf.link('Read CSV file', 'Send CSV');
  write(wf);
}

// ================================================================ 2 · Compliance documents
{
  const W = IDS.DOCUMENTS;
  const wf = workflow(W, '2 · Compliance documents: request → expiry alerts → verify', 'Requests missing documents, warns 30 days before expiry, blocks expired documents and collects uploads for verification.');
  header(wf, -200, '2 · Compliance documents: request → expiry alerts → verify', 'Daily: missing document → upload request · expiring within 30 days → reminder · expired → "do not book" alert · uploaded → consultant verifies.\nEach temp\'s compliance status is written back so the booking team can see it.');

  let at = laneBox(wf, 'check', 4, 6, 'Daily 08:00 (or from the console): document check', 'Never messages the same person about the same document twice in 24 hours.');
  wf.add(schedule('Every day 08:00', at(0, 0), { field: 'days', daysInterval: 1, triggerAtHour: 8 }));
  wf.add(calledBy('Run from console', at(0, 1)));
  wf.add(loadData('Load data (check)', at(1, 0)));
  wf.add(code('Plan document check', at(2, 0), src('documents-check.code.js')));
  wf.add(splitOut('Reminder log', at(3, 0), 'docUpdates'));
  wf.add(dtUpdate('Update documents', at(4, 0), 'Documents'));
  wf.add(splitOut('Compliance status', at(3, 1), 'tempUpdates'));
  wf.add(dtUpdate('Update temps', at(4, 1), 'Temps'));
  wf.add(splitOut('Requests and alerts', at(3, 2), 'messages'));
  wf.add(sendMessages('Send requests and alerts', at(4, 2)));
  wf.add(code('Check result', at(3, 3), RESULT));
  wf.chain('Every day 08:00', 'Load data (check)', 'Plan document check');
  wf.link('Run from console', 'Load data (check)');
  for (const n of ['Reminder log', 'Compliance status', 'Requests and alerts', 'Check result']) wf.link('Plan document check', n);
  wf.link('Reminder log', 'Update documents');
  wf.link('Compliance status', 'Update temps');
  wf.link('Requests and alerts', 'Send requests and alerts');

  at = laneBox(wf, 'form', 1, 4, 'Temp opens the upload link', 'Photo or PDF, from their phone.');
  wf.add(webhook(W, 'Temp opens upload link', at(0), 'GET', 'documents/upload'));
  wf.add(loadData('Load data (form)', at(1)));
  wf.add(code('Render upload page', at(2), src('documents-form.code.js'), { webhook: 'Temp opens upload link' }));
  wf.add(respondHtml('Show upload page', at(3)));
  wf.chain('Temp opens upload link', 'Load data (form)', 'Render upload page', 'Show upload page');

  at = laneBox(wf, 'upload', 3, 7, 'Temp uploads a document', 'Stored under files/documents, marked "check needed", consultant asked to verify.');
  wf.add(webhook(W, 'Temp uploads document', at(0, 0), 'POST', 'documents/upload'));
  wf.add(loadData('Load data (upload)', at(1, 0)));
  wf.add(code('Save upload', at(2, 0), src('documents-upload.code.js'), { webhook: 'Temp uploads document' }));
  wf.add(ifNotEmpty('File accepted?', at(3, 0), '$json.savePath'));
  wf.add(writeFile('Store document', at(4, 0)));
  wf.add(splitOut('Received', at(5, 0), 'updates'));
  wf.add(dtUpdate('Mark received', at(6, 0), 'Documents'));
  wf.add(splitOut('Verify request', at(5, 1), 'messages'));
  wf.add(sendMessages('Ask consultant to verify', at(6, 1)));
  wf.add(respondHtml('Show upload result', at(5, 2)));
  wf.chain('Temp uploads document', 'Load data (upload)', 'Save upload', 'File accepted?');
  wf.link('File accepted?', 'Store document', 0);
  wf.link('File accepted?', 'Show upload result', 1);
  for (const n of ['Received', 'Verify request', 'Show upload result']) wf.link('Store document', n);
  wf.link('Received', 'Mark received');
  wf.link('Verify request', 'Ask consultant to verify');

  at = laneBox(wf, 'verify', 2, 5, 'Consultant marks a document verified (console button)', 'Back to the console afterwards.');
  wf.add(webhook(W, 'Consultant verifies', at(0, 0), 'GET', 'documents/verify'));
  wf.add(loadData('Load data (verify)', at(1, 0)));
  wf.add(code('Verify document', at(2, 0), SMALL.DOC_VERIFY, { webhook: 'Consultant verifies' }));
  wf.add(splitOut('Verified', at(3, 0), 'updates'));
  wf.add(dtUpdate('Mark verified', at(4, 0), 'Documents'));
  wf.add(respondRedirect('Back to console', at(3, 1)));
  wf.chain('Consultant verifies', 'Load data (verify)', 'Verify document');
  wf.link('Verify document', 'Verified');
  wf.link('Verify document', 'Back to console');
  wf.link('Verified', 'Mark verified');

  at = laneBox(wf, 'view', 2, 6, 'Consultant views an uploaded file', 'Opens the stored photo or PDF.');
  wf.add(webhook(W, 'View uploaded file', at(0, 0), 'GET', 'documents/file'));
  wf.add(loadData('Load data (view)', at(1, 0)));
  wf.add(code('Locate file', at(2, 0), SMALL.DOC_FILE, { webhook: 'View uploaded file' }));
  wf.add(ifEquals('File on record?', at(3, 0), '$json.ok', 'true'));
  wf.add(readFile('Read document', at(4, 0)));
  wf.add(respondFile('Show file', at(5, 0), 'inline'));
  wf.add(respondHtml('No file page', at(4, 1)));
  wf.chain('View uploaded file', 'Load data (view)', 'Locate file', 'File on record?');
  wf.link('File on record?', 'Read document', 0);
  wf.link('File on record?', 'No file page', 1);
  wf.link('Read document', 'Show file');
  write(wf);
}

// ================================================================ 3 · Umbrella evidence
{
  const W = IDS.UMBRELLA;
  const wf = workflow(W, '3 · Umbrella evidence: monthly request → payslip checks', 'Requests monthly payslip evidence from each umbrella company and checks it against approved hours, assignment rates, the National Living Wage and non-taxable payments.');
  header(wf, -200, '3 · Umbrella evidence: monthly request → payslip checks', 'Joint and several liability (from 6 April 2026): agencies need documented checks, ongoing monitoring and records.\nChecks: R1 hours = approved · R2 income = hours × assignment rate · R3 taxable pay ≥ National Living Wage · R4 non-taxable payments. Flags are for human review, not decisions.');

  let at = laneBox(wf, 'request', 4, 6, '1st of the month 09:00 (or from the console): evidence request', 'Secure upload link to each umbrella paying our temps; a reminder if nothing has arrived.');
  wf.add(schedule('1st of month 09:00', at(0, 0), { field: 'months', monthsInterval: 1, triggerAtDayOfMonth: 1, triggerAtHour: 9 }));
  wf.add(calledBy('Run from console', at(0, 1)));
  wf.add(loadData('Load data (request)', at(1, 0)));
  wf.add(code('Plan requests', at(2, 0), src('umbrella-request.code.js')));
  wf.add(splitOut('New requests', at(3, 0), 'inserts'));
  wf.add(dtInsert('Open evidence request', at(4, 0), 'Evidence'));
  wf.add(splitOut('Reminders', at(3, 1), 'updates'));
  wf.add(dtUpdate('Count reminder', at(4, 1), 'Evidence'));
  wf.add(splitOut('Request emails', at(3, 2), 'messages'));
  wf.add(sendMessages('Email umbrella companies', at(4, 2)));
  wf.add(code('Request result', at(3, 3), RESULT));
  wf.chain('1st of month 09:00', 'Load data (request)', 'Plan requests');
  wf.link('Run from console', 'Load data (request)');
  for (const n of ['New requests', 'Reminders', 'Request emails', 'Request result']) wf.link('Plan requests', n);
  wf.link('New requests', 'Open evidence request');
  wf.link('Reminders', 'Count reminder');
  wf.link('Request emails', 'Email umbrella companies');

  at = laneBox(wf, 'form', 1, 4, 'Umbrella company opens the upload link', 'Shows the workers and the CSV columns expected.');
  wf.add(webhook(W, 'Umbrella opens link', at(0), 'GET', 'umbrella/evidence'));
  wf.add(loadData('Load data (form)', at(1)));
  wf.add(code('Render evidence page', at(2), src('umbrella-form.code.js'), { webhook: 'Umbrella opens link' }));
  wf.add(respondHtml('Show evidence page', at(3)));
  wf.chain('Umbrella opens link', 'Load data (form)', 'Render evidence page', 'Show evidence page');

  at = laneBox(wf, 'check', 4, 8, 'Umbrella uploads payslip CSV → checks', 'Every line checked and recorded (audit trail); compliance gets one email with any flags.');
  wf.add(webhook(W, 'Umbrella uploads evidence', at(0, 0), 'POST', 'umbrella/evidence'));
  wf.add(N('Read CSV', 'n8n-nodes-base.extractFromFile', 1, at(1, 0), { operation: 'csv', binaryPropertyName: 'file', options: {} }, { alwaysOutputData: true, onError: 'continueRegularOutput' }));
  wf.add(loadData('Load data (check)', at(2, 0)));
  wf.add(code('Check payslips', at(3, 0), src('umbrella-check.code.js'), { webhook: 'Umbrella uploads evidence' }));
  wf.add(ifNotEmpty('Keep original file?', at(4, 0), '$json.savePath'));
  wf.add(writeFile('Store evidence file', at(5, 0)));
  wf.add(splitOut('Evidence status', at(6, 0), 'evidenceUpdates'));
  wf.add(dtUpdate('Update evidence', at(7, 0), 'Evidence'));
  wf.add(splitOut('Payslip results', at(6, 1), 'checkInserts'));
  wf.add(dtInsert('Record payslip checks', at(7, 1), 'Payslip checks'));
  wf.add(splitOut('Compliance email', at(6, 2), 'messages'));
  wf.add(sendMessages('Email compliance', at(7, 2)));
  wf.add(respondHtml('Show receipt', at(6, 3)));
  wf.chain('Umbrella uploads evidence', 'Read CSV', 'Load data (check)', 'Check payslips', 'Keep original file?');
  wf.link('Keep original file?', 'Store evidence file', 0);
  wf.link('Keep original file?', 'Show receipt', 1);
  for (const n of ['Evidence status', 'Payslip results', 'Compliance email', 'Show receipt']) wf.link('Store evidence file', n);
  wf.link('Evidence status', 'Update evidence');
  wf.link('Payslip results', 'Record payslip checks');
  wf.link('Compliance email', 'Email compliance');
  write(wf);
}

// ================================================================ Demo console
{
  const W = IDS.CONSOLE;
  const wf = workflow(W, 'Demo console', 'The web page used in demos: live view of timesheets, compliance, umbrella checks, outbox and payroll exports, with buttons to run each automation.');
  header(wf, -200, 'Demo console', 'Open **http://localhost:5678/webhook/console** in a browser. The buttons run the three automations through their "Run from console" triggers.', 1400);
  let at = laneBox(wf, 'view', 1, 4, 'Show the console', 'Reads all data and renders the page.');
  wf.add(webhook(W, 'Open console', at(0), 'GET', 'console'));
  wf.add(loadData('Load data', at(1)));
  wf.add(code('Render console', at(2), src('console.code.js'), { webhook: 'Open console' }));
  wf.add(respondHtml('Show console', at(3)));
  wf.chain('Open console', 'Load data', 'Render console', 'Show console');

  const ids = { WF_CHASE: IDS.TIMESHEETS, WF_EXPORT: IDS.TIMESHEETS, WF_DOCS: IDS.DOCUMENTS, WF_UMBRELLA: IDS.UMBRELLA, WF_RESET: IDS.RESET };
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
  write(wf);
}

// ================================================================ 4 · Inbox triage
// Reads the real Forrof inbox (read-only), keeps the job applications, reads each CV locally
// and, only when someone clicks the button, asks OpenAI for a checklist summary. No scores.
{
  const W = IDS.TRIAGE;
  const wf = workflow(W, '4 · Inbox triage: job applications → CV checklist', 'Reads the inbox read-only, picks out job applications, reads CVs locally and, on request, summarises each CV against the role checklist. People make every decision.');
  header(wf, -200, '4 · Inbox triage: job applications → CV checklist', `Page: **${BASE_URL}/webhook/applications**. The inbox is read-only: nothing is marked read, moved or sent.\nAI runs only when someone clicks "Summarise" on the page, a batch at a time, and never scores or ranks candidates. Roles and settings live in the "Triage roles" and "Triage settings" tables.`, 1900);
  const prelude = `const DEFAULT_ROLES = ${JSON.stringify(INBOX.DEFAULT_ROLES)};\nconst DEFAULT_SETTINGS = ${JSON.stringify(INBOX.DEFAULT_SETTINGS)};\nconst BASE_URL = ${JSON.stringify(BASE_URL)};\n${INBOX_SHARED}`;
  // Each lane has its own "Get …" nodes; the shared helpers refer to them by their base name.
  const tcode = (name, pos, body, suffix = '', extra = '') => {
    let js = body;
    if (suffix) for (const t of ['Get applications', 'Get roles', 'Get settings']) js = js.replaceAll(`'${t}'`, `'${t}${suffix}'`);
    return code(name, pos, js, { prelude: prelude + extra });
  };
  // The applications page's stylesheet and browser script, injected into its Code node only.
  const pageAssets = `const CLIENT_CSS = ${JSON.stringify(src('inbox-dashboard.client.css') + '\n' + src('inbox-workspace.client.css'))};\nconst CLIENT_JS = ${JSON.stringify((src('inbox-sample.client.js') + '\n' + src('inbox-dashboard.client.js')).replace(/<\/script/gi, '<\\/script'))};\n`;
  const tGet = (label, table, pos, suffix) => ({ ...dtGet(table, pos), name: `${label}${suffix}` });
  const tCreate = (table, pos, suffix = '') => N(`Create ${table}${suffix}`, 'n8n-nodes-base.dataTable', 1.1, pos, {
    resource: 'table', operation: 'create', tableName: table, columns: { column: TRIAGE_TABLES[table].map(([name, type]) => ({ name, type })) }, options: { createIfNotExists: true },
  }, { executeOnce: true });
  const gets = (at, row, startCol, suffix) => {
    wf.add(tGet('Get applications', 'Applications', at(startCol, row), suffix));
    wf.add(tGet('Get roles', 'Triage roles', at(startCol + 1, row), suffix));
    wf.add(tGet('Get settings', 'Triage settings', at(startCol + 2, row), suffix));
    return [`Get applications${suffix}`, `Get roles${suffix}`, `Get settings${suffix}`];
  };

  let at = laneBox(wf, 'inbox', 2, 13, 'New email in the inbox (read-only) → find applications → read CVs', 'Keyword rules pick out applications (no AI). CV text is read locally from PDF or Word and stored with the CV file under files/applications.');
  const imapCred = CREDENTIALS.imap ? { credentials: { imap: CREDENTIALS.imap } } : {};
  wf.add(N('Read inbox (read-only)', 'n8n-nodes-base.emailReadImap', 2.2, at(0, 0), {
    mailbox: 'INBOX', postProcessAction: 'nothing', format: 'resolved', dataPropertyAttachmentsPrefixName: 'attachment_',
    options: { customEmailConfig: JSON.stringify(['ALL', ['SINCE', INBOX_SINCE]]), trackLastMessageId: true, forceReconnect: 60 },
  }, imapCred));
  for (const [i, t] of Object.keys(TRIAGE_TABLES).entries()) wf.add(tCreate(t, at(1 + i, 0)));
  const inboxGets = gets(at, 0, 4, '');
  wf.add(tcode('Find new applications', at(7, 0), src('inbox-find.code.js')));
  wf.add(tcode('Read CVs', at(8, 0), src('inbox-read-cv.code.js')));
  wf.add(ifNotEmpty('CV file to keep?', at(9, 0), '$json.savePath'));
  wf.add(writeFile('Store CV file', at(10, 0)));
  wf.add(splitOut('Application', at(11, 0), 'rows'));
  wf.add(dtInsert('Record application', at(12, 0), 'Applications'));
  wf.add(splitOut('Application (no CV)', at(10, 1), 'rows'));
  wf.add(dtInsert('Record application (no CV)', at(11, 1), 'Applications'));
  wf.chain('Read inbox (read-only)', ...Object.keys(TRIAGE_TABLES).map((t) => `Create ${t}`), ...inboxGets, 'Find new applications', 'Read CVs', 'CV file to keep?');
  wf.link('CV file to keep?', 'Store CV file', 0);
  wf.link('CV file to keep?', 'Application (no CV)', 1);
  wf.chain('Store CV file', 'Application', 'Record application');
  wf.link('Application (no CV)', 'Record application (no CV)');

  at = laneBox(wf, 'pdf', 2, 9, 'Read PDF CVs (after each inbox batch, or on request)', 'Reads the text of stored PDF CVs with n8n\'s "Extract from File" node, 100 per run, and queues them for the AI summary.');
  wf.add({ ...webhook(W, 'Read PDFs on request', at(0, 1), 'POST', 'applications/read-pdfs'), parameters: { httpMethod: 'POST', path: 'applications/read-pdfs', responseMode: 'onReceived', options: {} } });
  wf.add(tGet('Get applications', 'Applications', at(1, 0), ' (pdf)'));
  wf.add(tGet('Get settings', 'Triage settings', at(2, 0), ' (pdf)'));
  wf.add(tcode('Pick unread PDFs', at(3, 0), INBOX_SMALL.PICK_PDFS, ' (pdf)'));
  wf.add(readFile('Read stored PDF', at(4, 0)));
  wf.add(N('Extract PDF text', 'n8n-nodes-base.extractFromFile', 1, at(5, 0), { operation: 'pdf', binaryPropertyName: 'data', options: {} }, { onError: 'continueRegularOutput' }));
  wf.add(tcode('CV text', at(6, 0), INBOX_SMALL.PDF_TEXT, ' (pdf)'));
  wf.add(splitOut('PDF results', at(7, 0), 'updates'));
  wf.add(dtUpdate('Save CV text', at(8, 0), 'Applications'));
  wf.link('Record application', 'Get applications (pdf)');
  wf.link('Read PDFs on request', 'Get applications (pdf)');
  wf.chain('Get applications (pdf)', 'Get settings (pdf)', 'Pick unread PDFs', 'Read stored PDF', 'Extract PDF text', 'CV text', 'PDF results', 'Save CV text');

  at = laneBox(wf, 'page', 1, 6, 'Show the applications page', `${BASE_URL}/webhook/applications (add ?demo=1 to hide names for recordings).`);
  wf.add(webhook(W, 'Open applications page', at(0), 'GET', 'applications'));
  const pageGets = gets(at, 0, 1, ' (page)');
  wf.add(tcode('Render applications page', at(4), src('inbox-dashboard.code.js'), ' (page)', pageAssets));
  wf.add(respondHtml('Show page', at(5)));
  wf.chain('Open applications page', ...pageGets, 'Render applications page', 'Show page');

  at = laneBox(wf, 'ai', 3, 9, '"Summarise" button → OpenAI, one batch', 'Only when AI is switched on. Sends the role checklist and the CV text (cut to max_cv_chars) for each waiting CV, then records the checklist. Failed ones are retried on the next click.');
  wf.add(webhook(W, 'Summarise CVs', at(0, 0), 'POST', 'applications/ai'));
  const aiGets = gets(at, 0, 1, ' (ai)');
  wf.add(tcode('Pick waiting CVs', at(4, 0), src('inbox-ai-prepare.code.js'), ' (ai)'));
  wf.add(ifNotEmpty('Anything to send?', at(5, 0), '$json.app_id'));
  wf.add(N('Ask OpenAI', 'n8n-nodes-base.httpRequest', 4.2, at(6, 0), {
    method: 'POST', url: 'https://api.openai.com/v1/chat/completions',
    authentication: 'predefinedCredentialType', nodeCredentialType: 'openAiApi',
    sendBody: true, specifyBody: 'json', jsonBody: '={{ JSON.stringify($json.request) }}',
    options: { timeout: 120000, batching: { batch: { batchSize: 2, batchInterval: 300 } } },
  }, { onError: 'continueRegularOutput', ...(CREDENTIALS.openAiApi ? { credentials: { openAiApi: CREDENTIALS.openAiApi } } : {}) }));
  wf.add(tcode('Read AI answers', at(7, 0), src('inbox-ai-read.code.js'), ' (ai)'));
  wf.add(splitOut('Checklists', at(8, 0), 'updates'));
  wf.add(dtUpdate('Save checklists', at(8, 1), 'Applications'));
  wf.add(tcode('Back to page (summarised)', at(7, 1), INBOX_SMALL.backToPage('Summarise CVs')));
  wf.add(respondRedirect('Redirect (summarised)', at(7, 2)));
  wf.add(tcode('Back to page (nothing sent)', at(6, 1), INBOX_SMALL.backToPage('Summarise CVs')));
  wf.add(respondRedirect('Redirect (nothing sent)', at(6, 2)));
  wf.chain('Summarise CVs', ...aiGets, 'Pick waiting CVs', 'Anything to send?');
  wf.link('Anything to send?', 'Ask OpenAI', 0);
  wf.link('Anything to send?', 'Back to page (nothing sent)', 1);
  wf.chain('Ask OpenAI', 'Read AI answers', 'Checklists', 'Save checklists');
  wf.link('Read AI answers', 'Back to page (summarised)');
  wf.link('Back to page (summarised)', 'Redirect (summarised)');
  wf.link('Back to page (nothing sent)', 'Redirect (nothing sent)');

  at = laneBox(wf, 'mark', 2, 5, 'Shortlist / Not now buttons', 'A person records the decision; the AI never does.');
  wf.add(webhook(W, 'Mark decision', at(0, 0), 'GET', 'applications/mark'));
  wf.add(tGet('Get applications', 'Applications', at(1, 0), ' (mark)'));
  wf.add(tcode('Record decision', at(2, 0), INBOX_SMALL.MARK, ' (mark)'));
  wf.add(splitOut('Decision', at(3, 0), 'updates'));
  wf.add(dtUpdate('Save decision', at(4, 0), 'Applications'));
  wf.add(respondRedirect('Back to page (mark)', at(3, 1)));
  wf.chain('Mark decision', 'Get applications (mark)', 'Record decision');
  wf.link('Record decision', 'Decision');
  wf.link('Record decision', 'Back to page (mark)');
  wf.link('Decision', 'Save decision');

  at = laneBox(wf, 'setting', 3, 5, 'Turn AI on / off', 'Writes ai_enabled in the Triage settings table.');
  wf.add(webhook(W, 'Change setting', at(0, 0), 'POST', 'applications/settings'));
  wf.add(tGet('Get settings', 'Triage settings', at(1, 0), ' (setting)'));
  wf.add(tcode('Switch AI', at(2, 0), INBOX_SMALL.SETTING, ' (setting)'));
  wf.add(splitOut('Changed setting', at(3, 0), 'updates'));
  wf.add(dtUpdate('Save setting', at(4, 0), 'Triage settings'));
  wf.add(splitOut('New setting', at(3, 1), 'inserts'));
  wf.add(dtInsert('Add setting', at(4, 1), 'Triage settings'));
  wf.add(respondRedirect('Back to page (setting)', at(3, 2)));
  wf.chain('Change setting', 'Get settings (setting)', 'Switch AI');
  for (const n of ['Changed setting', 'New setting', 'Back to page (setting)']) wf.link('Switch AI', n);
  wf.link('Changed setting', 'Save setting');
  wf.link('New setting', 'Add setting');

  at = laneBox(wf, 'cv', 2, 6, 'View a stored CV', 'Only CV files recorded for an application can be opened.');
  wf.add(webhook(W, 'View CV', at(0, 0), 'GET', 'applications/cv'));
  wf.add(tGet('Get applications', 'Applications', at(1, 0), ' (cv)'));
  wf.add(tcode('Locate CV', at(2, 0), INBOX_SMALL.CV_FILE, ' (cv)'));
  wf.add(ifEquals('CV on file?', at(3, 0), '$json.ok', 'true'));
  wf.add(readFile('Read CV file', at(4, 0)));
  wf.add(respondFile('Show CV', at(5, 0), 'inline'));
  wf.add(respondHtml('No CV page', at(4, 1)));
  wf.chain('View CV', 'Get applications (cv)', 'Locate CV', 'CV on file?');
  wf.link('CV on file?', 'Read CV file', 0);
  wf.link('CV on file?', 'No CV page', 1);
  wf.link('Read CV file', 'Show CV');

  at = laneBox(wf, 'setup', 3, 7, 'Set up tables (first run)', 'Creates the tables and adds the starting roles and settings where missing. Safe to run again.');
  wf.add(webhook(W, 'Set up', at(0, 0), 'POST', 'applications/setup'));
  wf.add(N('Run setup manually', 'n8n-nodes-base.manualTrigger', 1, at(0, 1), {}));
  for (const [i, t] of Object.keys(TRIAGE_TABLES).entries()) wf.add(tCreate(t, at(1 + i, 0), ' (setup)'));
  wf.add(tGet('Get roles', 'Triage roles', at(4, 0), ' (setup)'));
  wf.add(tGet('Get settings', 'Triage settings', at(5, 0), ' (setup)'));
  wf.add(tcode('Starting values', at(6, 0), INBOX_SMALL.SEED, ' (setup)'));
  wf.add(splitOut('Roles to add', at(4, 1), 'roles'));
  wf.add(dtInsert('Add roles', at(5, 1), 'Triage roles'));
  wf.add(splitOut('Settings to add', at(4, 2), 'settings'));
  wf.add(dtInsert('Add settings', at(5, 2), 'Triage settings'));
  wf.add(respondHtml('Setup done', at(6, 2)));
  wf.chain('Set up', ...Object.keys(TRIAGE_TABLES).map((t) => `Create ${t} (setup)`), 'Get roles (setup)', 'Get settings (setup)', 'Starting values');
  wf.link('Run setup manually', 'Create Applications (setup)');
  for (const n of ['Roles to add', 'Settings to add', 'Setup done']) wf.link('Starting values', n);
  wf.link('Roles to add', 'Add roles');
  wf.link('Settings to add', 'Add settings');

  const data = write(wf);
  // Start the inbox reader at the first message, so its first run works through the backlog
  // (limited by INBOX_SINCE) instead of only mail that arrives after it is switched on.
  // On a rebuild, keep where it got to so the backlog isn't downloaded again.
  data.staticData = CREDENTIALS.staticData || { 'node:Read inbox (read-only)': { lastMessageUid: 1 } };
  fs.writeFileSync(path.join(OUT, `${data.id}.json`), JSON.stringify(data, null, 2));
}

console.log(`Built ${fs.readdirSync(OUT).filter((f) => f.endsWith('.json')).length} workflows in ${OUT}`);
