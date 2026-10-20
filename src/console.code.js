// n8n Code node: renders the demo console from the bundle returned by "Load data".
const config = configFrom();
const temps = tableRows('Temps');
const clients = tableRows('Clients');
const umbrellas = tableRows('Umbrellas');
const timesheets = tableRows('Timesheets');
const documents = tableRows('Documents');
const evidence = tableRows('Evidence');
const checks = tableRows('Payslip checks');
const outbox = tableRows('Outbox');
const exportsList = tableRows('Exports');

const base = config.base_url || 'http://localhost:5678';
const weekEnding = config.week_ending;
const q = $('Webhook').first().json.query || {};
const notice = q.done ? String(q.done) : '';

const byId = (list, key) => Object.fromEntries(list.map((r) => [r[key], r]));
const T = byId(temps, 'temp_id');
const C = byId(clients, 'client_id');
const U = byId(umbrellas, 'umbrella_id');
const name = fullName;
const fmtDay = (d) => (d ? new Date(d).toLocaleDateString('en-GB', { timeZone: 'UTC', day: 'numeric', month: 'short', year: 'numeric' }) : '—');
const fmtTime = (d) => (d ? new Date(d).toLocaleString('en-GB', { timeZone: 'Europe/London', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '');

const pill = (status) => {
  const map = {
    missing: ['Missing', 'red'], submitted: ['Awaiting client', 'amber'], approved: ['Approved', 'green'],
    queried: ['Queried by client', 'red'], exported: ['Sent to payroll', 'blue'],
    verified: ['Verified', 'green'], received: ['Check needed', 'amber'], expiring: ['Expiring soon', 'amber'], expired: ['Expired', 'red'],
    requested: ['Requested', 'amber'], ok: ['Checked: OK', 'green'], flagged: ['Flagged', 'red'], none: ['Not requested', 'grey'],
    Compliant: ['Compliant', 'green'], 'Action needed': ['Action needed', 'amber'], Blocked: ['Do not book', 'red'],
  };
  const [label, colour] = map[status] || [status, 'grey'];
  return `<span class="pill ${colour}">${esc(label)}</span>`;
};

// ---------- timesheets
const thisWeek = timesheets.filter((t) => t.week_ending === weekEnding).sort((a, b) => a.temp_id.localeCompare(b.temp_id));
const count = (list, s) => list.filter((x) => x.status === s).length;
const tsRows = thisWeek.map((t) => {
  const temp = T[t.temp_id];
  const client = C[t.client_id];
  const route = temp?.pay_route === 'PAYE' ? 'PAYE' : U[temp?.pay_route]?.name || temp?.pay_route;
  let action = '';
  if (t.status === 'missing') action = `<a class="link" target="_blank" href="${base}/webhook/timesheet?t=${t.submit_token}">Temp's link ↗</a>`;
  if (t.status === 'submitted') action = `<a class="link" target="_blank" href="${base}/webhook/timesheet/approve?t=${t.approve_token}">Client's approval link ↗</a>`;
  return `<tr><td><strong>${esc(name(temp))}</strong><div class="muted">${esc(temp?.role)}</div></td>
    <td>${esc(client?.name)}</td><td>${esc(route)}</td>
    <td class="num">${t.hours ? Number(t.hours).toFixed(1) : '—'}</td>
    <td>${pill(t.status)}</td><td class="num">${t.reminders_sent || 0}</td><td>${action}</td></tr>`;
}).join('');

// ---------- compliance
const today = new Date(new Date().toISOString().slice(0, 10));
const docState = (d) => {
  if (d.status === 'missing') return 'missing';
  if (d.expiry_date) {
    const days = Math.round((new Date(d.expiry_date) - today) / 86400000);
    if (days < 0) return 'expired';
    if (days <= 30 && d.status === 'verified') return 'expiring';
  }
  return d.status;
};
const complianceOf = (tempId) => {
  const docs = documents.filter((d) => d.temp_id === tempId).map(docState);
  if (docs.includes('expired') || documents.some((d) => d.temp_id === tempId && d.doc_type === 'Right to work' && d.status === 'missing')) return 'Blocked';
  if (docs.some((s) => s !== 'verified')) return 'Action needed';
  return 'Compliant';
};
const compliance = temps.map((t) => complianceOf(t.temp_id));
const docRows = temps.map((t) => {
  const docs = documents.filter((d) => d.temp_id === t.temp_id).map((d) => {
    const state = docState(d);
    let extra = '';
    if (state === 'missing' || state === 'expired' || state === 'expiring') extra = ` <a class="link" target="_blank" href="${base}/webhook/documents/upload?t=${d.upload_token}">Upload link ↗</a>`;
    if (d.status === 'received') extra = ` <a class="btn tiny" href="${base}/webhook/documents/verify?id=${d.doc_id}">Mark verified</a>${d.file_name ? ` <a class="link" target="_blank" href="${base}/webhook/documents/file?id=${d.doc_id}">View file ↗</a>` : ''}`;
    return `<div class="doc">${pill(state)} <span>${esc(d.doc_type)}</span><span class="muted"> · ${d.expiry_date ? 'expires ' + fmtDay(d.expiry_date) : 'no expiry date'}</span>${extra}</div>`;
  }).join('');
  return `<tr><td><strong>${esc(name(t))}</strong><div class="muted">${esc(C[t.client_id]?.name)}</div></td><td>${pill(complianceOf(t.temp_id))}</td><td>${docs}</td></tr>`;
}).join('');

// ---------- umbrella evidence
const period = config.evidence_period;
const periodLabel = period ? new Date(`${period}-01T12:00:00Z`).toLocaleDateString('en-GB', { timeZone: 'UTC', month: 'long', year: 'numeric' }) : '';
const umbRows = umbrellas.map((u) => {
  const ev = evidence.find((e) => e.umbrella_id === u.umbrella_id && e.period === period);
  const status = ev ? ev.status : 'none';
  const link = ev && ev.status === 'requested' ? `<a class="link" target="_blank" href="${base}/webhook/umbrella/evidence?t=${ev.upload_token}">Umbrella's upload link ↗</a>` : '';
  const lines = ev ? checks.filter((c) => c.evidence_id === ev.evidence_id) : [];
  const lineHtml = lines.map((c) => `<tr class="${c.result === 'Flag' ? 'flagrow' : ''}"><td>${esc(c.worker_name)}</td><td class="num">${c.hours}</td><td class="num">${money(c.expected_income)}</td><td class="num">${money(c.assignment_income)}</td><td class="num">${money(c.gross_per_hour)}/hr</td><td>${c.result === 'Flag' ? `<span class="pill red">Flag</span> ${esc(c.reasons)}` : '<span class="pill green">OK</span>'}</td></tr>`).join('');
  return `<div class="umb"><div class="umbhead"><strong>${esc(u.name)}</strong> ${pill(status)} <span class="muted">${esc(periodLabel)}${ev?.received_at ? ' · received ' + fmtTime(ev.received_at) : ''}</span> ${link}</div>
    ${lineHtml ? `<table class="inner"><tr><th>Worker</th><th>Hours</th><th>Expected income</th><th>On payslip</th><th>Taxable pay</th><th>Result</th></tr>${lineHtml}</table>` : ''}</div>`;
}).join('');

// ---------- outbox
const msgs = outbox.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at))).slice(0, 40);
const outRows = msgs.map((m) => `<tr><td class="muted nowrap">${fmtTime(m.created_at)}</td><td><span class="chan ${m.channel === 'SMS' ? 'sms' : 'email'}">${esc(m.channel)}</span></td>
  <td><strong>${esc(m.to_name)}</strong><div class="muted">${esc(m.to_address)}</div></td>
  <td>${m.subject ? `<strong>${esc(m.subject)}</strong><br>` : ''}${esc(m.body)}${m.link ? `<br><a class="link" target="_blank" href="${esc(m.link)}">Open link ↗</a>` : ''}</td>
  <td class="muted">${esc(m.workflow)}<div>${esc(m.delivery)}</div></td></tr>`).join('');

const exportRows = exportsList.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at))).map((x) => `<tr><td>${fmtTime(x.created_at)}</td><td>${esc(x.file_name)}</td><td class="num">${x.rows}</td><td class="num">${money(x.pay_total)}</td><td class="num">${money(x.invoice_total)}</td><td><a class="link" href="${base}/webhook/payroll/file?name=${encodeURIComponent(x.file_name)}">Download CSV ↓</a></td></tr>`).join('');

const action = (run, label, hint) => `<form method="post" action="${base}/webhook/console/run"><input type="hidden" name="run" value="${run}"><button class="btn" type="submit">${label}</button><div class="hint">${hint}</div></form>`;

const html = `<!doctype html><html lang="en-GB"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(config.agency_name)} · Back-office automation</title>
<style>
:root{--ink:#14213d;--muted:#64748b;--line:#e2e8f0;--bg:#f6f8fb;--card:#fff;--brand:#2952cc;--green:#0f8a5f;--amber:#b7791f;--red:#c53030;--blue:#2952cc}
*{box-sizing:border-box}body{margin:0;font:14px/1.45 "Segoe UI",system-ui,-apple-system,sans-serif;color:var(--ink);background:var(--bg)}
header{background:var(--ink);color:#fff}.hd{max-width:1240px;margin:0 auto;padding:18px 28px;display:flex;justify-content:space-between;align-items:center;gap:16px}
header h1{margin:0;font-size:19px;font-weight:600}header .sub{color:#cbd5e1;font-size:13px}
.wrap{max-width:1240px;margin:0 auto;padding:22px 28px 40px}
.notice{background:#e8f0fe;border:1px solid #c3d4fb;color:#1e3a8a;padding:10px 14px;border-radius:8px;margin-bottom:16px}
.kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:18px}
.kpi{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:14px 16px}
.kpi .label{color:var(--muted);font-size:12px;text-transform:uppercase;letter-spacing:.04em}.kpi .value{font-size:26px;font-weight:650;margin-top:4px}.kpi .detail{color:var(--muted);font-size:12px}
.actions{display:grid;grid-template-columns:repeat(5,1fr);gap:12px;margin-bottom:22px}
.actions form{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:12px}
.btn{background:var(--brand);color:#fff;border:0;border-radius:7px;padding:9px 12px;font-weight:600;cursor:pointer;width:100%;font-size:13px;text-decoration:none;display:inline-block;text-align:center}
.btn:hover{filter:brightness(1.08)}.btn.tiny{width:auto;padding:3px 8px;font-size:12px}.btn.ghost{background:#fff;color:var(--ink);border:1px solid var(--line)}
.hint{color:var(--muted);font-size:12px;margin-top:6px}
section{background:var(--card);border:1px solid var(--line);border-radius:10px;margin-bottom:18px;overflow:hidden}
section h2{margin:0;padding:14px 16px;font-size:15px;border-bottom:1px solid var(--line);display:flex;justify-content:space-between;align-items:baseline}
section h2 span{color:var(--muted);font-weight:400;font-size:12px}
table{width:100%;border-collapse:collapse}th,td{text-align:left;padding:9px 14px;border-bottom:1px solid var(--line);vertical-align:top}
th{font-size:12px;color:var(--muted);font-weight:600;background:#fafbfd}tr:last-child td{border-bottom:0}
.num{text-align:right;font-variant-numeric:tabular-nums}.muted{color:var(--muted);font-size:12px}.nowrap{white-space:nowrap}
.pill{display:inline-block;padding:2px 9px;border-radius:999px;font-size:12px;font-weight:600;white-space:nowrap}
.pill.green{background:#e3f5ec;color:var(--green)}.pill.amber{background:#fdf3e1;color:var(--amber)}.pill.red{background:#fde8e8;color:var(--red)}.pill.blue{background:#e8eefc;color:var(--blue)}.pill.grey{background:#eef1f5;color:var(--muted)}
.link{color:var(--brand);text-decoration:none;font-weight:600;font-size:12px}.link:hover{text-decoration:underline}
.doc{margin:2px 0}.umb{padding:12px 16px;border-bottom:1px solid var(--line)}.umb:last-child{border-bottom:0}.umbhead{margin-bottom:8px}
table.inner{border:1px solid var(--line);border-radius:8px}table.inner td,table.inner th{padding:6px 10px}.flagrow{background:#fff7f7}
.chan{display:inline-block;font-size:11px;font-weight:700;padding:2px 7px;border-radius:5px}.chan.sms{background:#efe7fd;color:#6b21a8}.chan.email{background:#e0f2fe;color:#075985}
footer{color:var(--muted);font-size:12px;text-align:center;margin-top:10px}
@media (max-width:900px){.kpis{grid-template-columns:repeat(2,1fr)}.actions{grid-template-columns:1fr 1fr}}
</style></head><body>
<header><div class="hd"><div><h1>${esc(config.agency_name)} · Back-office automation</h1><div class="sub">Temp desk demo · timesheets, compliance documents and umbrella checks · week ending ${fmtDay(weekEnding)}</div></div>
<div class="sub">Built by Forrof · runs on n8n</div></div></header>
<div class="wrap">
${notice ? `<div class="notice">✓ ${esc(notice)}</div>` : ''}
<div class="kpis">
 <div class="kpi"><div class="label">Timesheets this week</div><div class="value">${count(thisWeek, 'approved') + count(thisWeek, 'exported')} / ${thisWeek.length}</div><div class="detail">approved · ${count(thisWeek, 'missing')} missing · ${count(thisWeek, 'submitted')} awaiting client</div></div>
 <div class="kpi"><div class="label">Temps compliant</div><div class="value">${compliance.filter((c) => c === 'Compliant').length} / ${temps.length}</div><div class="detail">${compliance.filter((c) => c === 'Blocked').length} blocked · ${compliance.filter((c) => c === 'Action needed').length} need action</div></div>
 <div class="kpi"><div class="label">Umbrella evidence · ${esc(periodLabel)}</div><div class="value">${evidence.filter((e) => e.period === period && e.status !== 'requested').length} / ${umbrellas.length}</div><div class="detail">received · ${checks.filter((c) => c.result === 'Flag').length} payslip flags</div></div>
 <div class="kpi"><div class="label">Messages sent by automation</div><div class="value">${outbox.length}</div><div class="detail">SMS and email, logged below</div></div>
</div>
<div class="actions">
 ${action('chase', '1 · Run Monday timesheet chase', 'Texts every temp with a missing timesheet and lists the rest for the consultant.')}
 ${action('export', '2 · Run payroll export', 'Approved hours → CSV for payroll and invoicing.')}
 ${action('documents', '3 · Run document check', 'Requests missing documents, warns before expiry, blocks expired.')}
 ${action('umbrella', '4 · Request umbrella evidence', 'Monthly payslip evidence request to each umbrella.')}
 <form method="post" action="${base}/webhook/console/run"><input type="hidden" name="run" value="reset"><button class="btn ghost" type="submit">Reset demo data</button><div class="hint">Back to the Monday-morning starting point.</div></form>
</div>
<section><h2>1 · Timesheets <span>week ending ${fmtDay(weekEnding)} · open the links to act as the temp or the client</span></h2>
<table><tr><th>Temp</th><th>Client</th><th>Pay route</th><th class="num">Hours</th><th>Status</th><th class="num">Reminders</th><th></th></tr>${tsRows}</table></section>
<section><h2>2 · Compliance documents <span>right to work and role certificates · checked daily</span></h2>
<table><tr><th>Temp</th><th>Status</th><th>Documents</th></tr>${docRows}</table></section>
<section><h2>3 · Umbrella company evidence <span>payslips checked against approved hours, assignment rate and the £${esc(config.national_living_wage)} National Living Wage · flags are for human review</span></h2>${umbRows}</section>
<section><h2>Outbox <span>${config.sms_enabled === 'true' || config.email_enabled === 'true' ? 'live sending on' : 'demo mode: messages are logged here, not sent'}</span></h2>
<table><tr><th>When</th><th>Channel</th><th>To</th><th>Message</th><th>Sent by</th></tr>${outRows || '<tr><td colspan="5" class="muted">No messages yet. Run an automation above.</td></tr>'}</table></section>
<section><h2>Payroll exports</h2><table><tr><th>Created</th><th>File</th><th class="num">Rows</th><th class="num">Pay</th><th class="num">Invoice</th><th></th></tr>${exportRows || '<tr><td colspan="6" class="muted">No exports yet.</td></tr>'}</table></section>
<footer>All people, companies and numbers are fictional. Hiring decisions are never automated; compliance flags are for human review. · Forrof</footer>
</div></body></html>`;

return [{ json: { html } }];
