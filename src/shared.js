// Shared helpers injected at the top of every Code node by scripts/build-workflows.mjs.
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = (n) => '£' + Number(n || 0).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const round2 = (n) => Math.round(Number(n || 0) * 100) / 100;
const newToken = () => require('crypto').randomBytes(18).toString('hex');
const nowIso = () => new Date().toISOString();
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-GB', { timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }) : '');
// Every Code node runs right after "Load data", whose single item holds one array per data table.
const DATA = $input.first().json || {};
const tableRows = (table) => (Array.isArray(DATA[table]) ? DATA[table] : []);
const configFrom = () => Object.fromEntries(tableRows('Config').map((r) => [r.key, r.value]));
const fullName = (t) => (t ? `${t.first_name} ${t.last_name}` : '');

// A clean, mobile-friendly page for temps, clients and umbrella companies.
const page = (title, agency, body) => `<!doctype html><html lang="en-GB"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title>
<style>
*{box-sizing:border-box}body{margin:0;font:15px/1.5 "Segoe UI",system-ui,-apple-system,sans-serif;color:#14213d;background:#f6f8fb}
.top{background:#14213d;color:#fff;padding:14px 20px;font-weight:600}.top span{color:#cbd5e1;font-weight:400;font-size:13px;margin-left:8px}
.card{max-width:560px;margin:22px auto;background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:22px}
h1{font-size:20px;margin:0 0 6px}p{margin:6px 0 14px}.muted{color:#64748b;font-size:13px}
label{display:block;font-weight:600;font-size:13px;margin:12px 0 4px}input,select{width:100%;padding:10px;border:1px solid #cbd5e1;border-radius:8px;font:inherit}
.days{display:grid;grid-template-columns:repeat(7,1fr);gap:6px}.days label{font-size:12px;text-align:center;margin:0 0 4px}.days input{text-align:center;padding:8px 4px}
.btn{display:inline-block;background:#2952cc;color:#fff;border:0;border-radius:8px;padding:11px 16px;font-weight:600;font-size:15px;cursor:pointer;text-decoration:none;margin-top:16px}
.btn.alt{background:#fff;color:#14213d;border:1px solid #cbd5e1;margin-left:8px}
.ok{background:#e3f5ec;color:#0f8a5f;border-radius:8px;padding:12px 14px;font-weight:600}.warn{background:#fdf3e1;color:#8a5a12;border-radius:8px;padding:12px 14px}
table{width:100%;border-collapse:collapse;margin-top:8px}td,th{padding:7px 4px;border-bottom:1px solid #e2e8f0;text-align:left;font-size:14px}.num{text-align:right}
.foot{text-align:center;color:#94a3b8;font-size:12px;margin:10px 0 30px}
</style></head><body><div class="top">${esc(agency)}<span>Secure link</span></div><div class="card">${body}</div><div class="foot">Demo by Forrof · fictional data</div></body></html>`;
