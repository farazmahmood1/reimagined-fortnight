// Small Code-node bodies used by build-workflows.mjs (exported as strings by name).

export const PAYMENT_FILE = `
// GET /webhook/payments/file?name=...: only plain payment file names are accepted.
const name = String($('Webhook').first().json.query?.name || '');
const ok = /^payment-run-\\d{4}-\\d{2}-\\d{2}-\\d{8}T\\d{6}\\.csv$/.test(name);
const html = ok ? '' : page('Not found', '<h1>File not found</h1><p class="muted">That payment file does not exist.</p>');
return [{ json: { ok, filePath: ok ? 'payment-runs/' + name : '', fileName: name, html } }];
`;

export const EVIDENCE_FILE = `
// GET /webhook/farmplan/file?p=PACK_TOKEN&id=ITEM_ID: view an uploaded evidence file. The pack token proves the item belongs to that pack.
const q = $('Webhook').first().json.query || {};
const farm = tableRows('Farms').find((f) => q.p && f.pack_token === String(q.p));
const item = farm && tableRows('Evidence').find((e) => e.item_id === String(q.id || '') && e.farm_id === farm.farm_id);
const ok = !!(item && item.file_name && /^[A-Za-z0-9._-]+$/.test(item.file_name));
const html = ok ? '' : page('Not found', '<h1>No file on record</h1><p class="muted">This item has no uploaded file.</p>');
return [{ json: { ok, filePath: ok ? 'evidence/' + item.file_name : '', fileName: ok ? item.file_name : '', html } }];
`;

export const REGISTER_FILE = `
// GET /webhook/register/file?t=UPLOAD_TOKEN: view an uploaded certificate or consent.
const token = String($('Webhook').first().json.query?.t || '');
const rec = tableRows('Register').find((r) => token && r.upload_token === token);
const ok = !!(rec && rec.file_name && /^[A-Za-z0-9._-]+$/.test(rec.file_name));
const html = ok ? '' : page('Not found', '<h1>No file on record</h1><p class="muted">This record has no uploaded file.</p>');
return [{ json: { ok, filePath: ok ? 'register/' + rec.file_name : '', fileName: ok ? rec.file_name : '', html } }];
`;

export const AUDIT_CSV = `
// GET /webhook/audit/csv: the whole audit trail as a CSV file.
const rows = tableRows('Audit log').sort((a, b) => String(a.at).localeCompare(String(b.at)));
const cell = (v) => { const s = String(v ?? ''); return /[",\\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
const header = ['When (NZ time)', 'Who', 'Agent or person', 'Area', 'Subject', 'What happened', 'Detail'];
const lines = rows.map((a) => [new Date(a.at).toLocaleString('en-NZ', { timeZone: TZ, hour12: false }), a.actor, a.actor_type, a.flow, a.subject, a.action, a.detail].map(cell).join(','));
const csv = [header.join(','), ...lines].join('\\r\\n') + '\\r\\n';
const fileName = 'audit-trail-' + nzToday() + '.csv';
return [{ json: { fileName }, binary: { data: { data: Buffer.from(csv, 'utf8').toString('base64'), mimeType: 'text/csv', fileName, fileExtension: 'csv' } } }];
`;

export const CONSOLE_RUN = `
// POST /webhook/console/run: run an automation from the console, then return to the console.
const run = String($('Webhook').first().json.body?.run || '');
const targets = {
  check: { workflow: 'WF_INVOICES', label: 'Check new invoices', tab: 'invoices' },
  payments: { workflow: 'WF_INVOICES', label: 'Payment file', tab: 'invoices' },
  chase: { workflow: 'WF_PLAN', label: 'Farm plan chase', tab: 'plan' },
  watch: { workflow: 'WF_REGISTER', label: 'Consents and certificates watch', tab: 'consents' },
  reset: { workflow: 'WF_RESET', label: 'Reset', tab: 'gate' },
};
const t = targets[run];
return [{ json: { valid: !!t, workflowId: t ? WORKFLOW_IDS[t.workflow] : '', label: t ? t.label : '', run, tab: t ? t.tab : 'gate' } }];
`;

export const CONSOLE_DONE = `
// Build the redirect back to the console with the automation's summary.
const result = $input.first().json || {};
const choice = $('Choose automation').first().json;
const notice = !choice.valid ? 'Unknown action.' : result.summary ? \`\${choice.label}: \${result.summary}\` : \`\${choice.label} finished.\`;
// Absolute URL: the console page is sandboxed, so browsers would mis-resolve a relative redirect.
return [{ json: { location: \`\${BASE_URL}/webhook/console?tab=\${choice.tab || 'gate'}&done=\${encodeURIComponent(notice)}\` } }];
`;
