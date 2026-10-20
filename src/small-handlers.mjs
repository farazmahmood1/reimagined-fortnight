// Small Code-node bodies used by build-workflows.mjs (exported as strings by name).

export const PAYROLL_FILE = `
// GET /webhook/payroll/file?name=...: only plain export file names are accepted.
const name = String($('Webhook').first().json.query?.name || '');
const ok = /^payroll-we-\\d{4}-\\d{2}-\\d{2}-\\d{8}T\\d{4}\\.csv$/.test(name);
const html = ok ? '' : page('Not found', 'Harbourline Recruitment', '<h1>File not found</h1><p class="muted">That export does not exist.</p>');
return [{ json: { ok, filePath: ok ? 'payroll-exports/' + name : '', fileName: name, html } }];
`;

export const DOC_VERIFY = `
// GET /webhook/documents/verify?id=D00x: consultant marks an uploaded document as verified.
const config = configFrom('Config');
const id = String($('Webhook').first().json.query?.id || '');
const doc = tableRows('Documents').find((d) => d.doc_id === id);
const temp = doc && tableRows('Temps').find((t) => t.temp_id === doc.temp_id);
const ok = doc && doc.status === 'received';
const notice = ok ? \`Verified \${fullName(temp)}'s \${doc.doc_type}.\` : 'Nothing to verify for that document.';
return [{ json: {
  updates: ok ? [{ id: doc.id, status: 'verified', verified_at: nowIso(), verified_by: config.consultant_name }] : [],
  location: \`\${config.base_url}/webhook/console?done=\${encodeURIComponent(notice)}\`,
} }];
`;

export const DOC_FILE = `
// GET /webhook/documents/file?id=D00x: view an uploaded document (consultant only, from the console).
const id = String($('Webhook').first().json.query?.id || '');
const doc = tableRows('Documents').find((d) => d.doc_id === id);
const ok = !!(doc && doc.file_name && /^[A-Za-z0-9._-]+$/.test(doc.file_name));
const html = ok ? '' : page('Not found', configFrom().agency_name, '<h1>No file on record</h1><p class="muted">This document has not been uploaded yet.</p>');
return [{ json: { ok, filePath: ok ? 'documents/' + doc.file_name : '', fileName: ok ? doc.file_name : '', html } }];
`;

export const CONSOLE_RUN = `
// POST /webhook/console/run: run an automation from the console, then return to the console.
const run = String($('Webhook').first().json.body?.run || '');
const targets = {
  chase: { workflow: 'WF_CHASE', label: 'Monday timesheet chase' },
  export: { workflow: 'WF_EXPORT', label: 'Payroll export' },
  documents: { workflow: 'WF_DOCS', label: 'Document check' },
  umbrella: { workflow: 'WF_UMBRELLA', label: 'Umbrella evidence request' },
  reset: { workflow: 'WF_RESET', label: 'Reset' },
};
const t = targets[run];
return [{ json: { valid: !!t, workflowId: t ? WORKFLOW_IDS[t.workflow] : '', label: t ? t.label : '', run } }];
`;

export const CONSOLE_DONE = `
// Build the redirect back to the console with the automation's summary.
const result = $input.first().json || {};
const choice = $('Choose automation').first().json;
const notice = !choice.valid ? 'Unknown action.' : result.summary ? \`\${choice.label}: \${result.summary}\` : \`\${choice.label} finished.\`;
// Absolute URL: the console page is sandboxed, so browsers would mis-resolve a relative redirect.
return [{ json: { location: \`\${BASE_URL}/webhook/console?done=\${encodeURIComponent(notice)}\` } }];
`;
