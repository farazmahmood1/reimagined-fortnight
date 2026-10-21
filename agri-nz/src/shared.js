// Shared helpers injected at the top of every Code node by scripts/build-workflows.mjs.
const TZ = 'Pacific/Auckland';
const DAY_MS = 86400000;
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const round2 = (n) => Math.round(Number((Number(n || 0) * 100).toFixed(6))) / 100;
const money = (n) => new Intl.NumberFormat('en-NZ', { style: 'currency', currency: 'NZD' }).format(Number(n || 0));
const priceText = (n) => '$' + Number(n || 0).toLocaleString('en-NZ', { minimumFractionDigits: 2, maximumFractionDigits: 4 });
const qtyText = (n) => Number(n || 0).toLocaleString('en-NZ', { maximumFractionDigits: 2 });
const unitText = (qty, unit) => (Number(qty) !== 1 && { load: 'loads', bale: 'bales' }[unit]) || unit;
const newToken = () => require('crypto').randomBytes(18).toString('hex');
// Each call is one millisecond later than the last, so rows written in one run keep their order.
let _seq = 0;
const nowIso = () => new Date(Date.now() + _seq++).toISOString();

// Calendar dates are plain "YYYY-MM-DD" strings in New Zealand time, so this PC's own clock never matters.
const nzToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const dateOf = (s) => new Date(`${String(s).slice(0, 10)}T00:00:00Z`);
const isoDay = (d) => d.toISOString().slice(0, 10);
const addDays = (s, n) => isoDay(new Date(dateOf(s).getTime() + n * DAY_MS));
const addMonths = (s, n) => {
  const d = dateOf(s);
  const day = d.getUTCDate();
  const target = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, 1));
  const last = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(day, last));
  return isoDay(target);
};
const daysBetween = (from, to) => Math.round((dateOf(to) - dateOf(from)) / DAY_MS);
const fmtDate = (s) => (s ? dateOf(s).toLocaleDateString('en-NZ', { timeZone: 'UTC', day: 'numeric', month: 'short', year: 'numeric' }) : '—');
const fmtLong = (s) => (s ? dateOf(s).toLocaleDateString('en-NZ', { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : '—');
const fmtTime = (iso) => (iso ? new Date(iso).toLocaleString('en-NZ', { timeZone: TZ, day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true }) : '');
const ago = (iso) => {
  if (!iso) return '';
  const s = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  return `${Math.round(s / 86400)} d ago`;
};

// Every Code node runs right after "Load data", whose single item holds one array per data table.
const DATA = $input.first().json || {};
const tableRows = (table) => (Array.isArray(DATA[table]) ? DATA[table] : []);
const configFrom = () => Object.fromEntries(tableRows('Config').map((r) => [r.key, r.value]));
const firstName = (name) => String(name || '').split(' ')[0];
const person = (cfg, role) => ({ name: cfg[`${role}_name`] || '', email: cfg[`${role}_email`] || '', phone: cfg[`${role}_phone`] || '' });

// A message for the Shared · Send message workflow. Nothing is sent from anywhere else.
const msg = (m) => ({
  channel: m.channel, to_name: m.to_name || '', to_address: m.to_address || '', subject: m.subject || '',
  body: m.body || '', link: m.link || '', related: m.related || '', workflow: m.workflow || '',
});
// Text the phone if we have one, otherwise email. `both` sends the email as well.
const reach = (p, m, how = 'auto') => {
  const out = [];
  const to = { to_name: p.name, related: m.related, workflow: m.workflow };
  if (p.phone && how !== 'email') out.push(msg({ ...to, channel: 'SMS', to_address: p.phone, body: m.sms || m.body, link: m.link }));
  if (p.email && (how === 'email' || how === 'both' || !p.phone)) out.push(msg({ ...to, channel: 'Email', to_address: p.email, subject: m.subject, body: m.body, link: m.link }));
  return out;
};
// One line of the audit trail: who did what, to what, and when.
const auditRow = (actor, type, flow, subject, action, detail = '') => ({
  at: nowIso(), actor, actor_type: type, flow, subject: String(subject).slice(0, 200), action: String(action).slice(0, 200), detail: String(detail).slice(0, 700),
});
// The page a webhook link returns after a person acts: back to the console, on the same tab, with a notice.
const backToConsole = (cfg, tab, notice) => `${cfg.base_url}/webhook/console?tab=${encodeURIComponent(tab || 'gate')}&done=${encodeURIComponent(notice)}`;

const pill = (tone, text) => `<span class="pill ${tone}">${esc(text)}</span>`;
const callout = (tone, html) => `<div class="callout ${tone}">${html}</div>`;

// One type family (Figtree, from Google Fonts) with the system font as the fallback when offline.
const FONT_LINK = '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Figtree:wght@400..800&display=swap">';
// The business's mark: three tussock blades on dark teal.
const BRAND_MARK = '<svg class="mark" width="34" height="34" viewBox="0 0 34 34" aria-hidden="true"><rect width="34" height="34" rx="10" fill="#0e3a35"/><g fill="none" stroke="#d6f04a" stroke-width="2.4" stroke-linecap="round"><path d="M17 26V10"/><path d="M17 26c-.8-5.6-3.8-9-8.5-11"/><path d="M17 26c.8-5.6 3.8-9 8.5-11"/></g></svg>';

const THEME = `
:root{--bg:#f6f4ee;--paper:#fff;--ink:#0f1f1b;--ink2:#34433f;--muted:#6b7672;--line:#e8e5dc;--line2:#d9d5c9;--fill:#efece4;
--teal:#0e3a35;--teal2:#1d5c53;--teal3:#2f7a6e;--lime:#d6f04a;
--ok:#18794e;--okbg:#e5f3ea;--warn:#8f5600;--warnbg:#fbf0d6;--bad:#b42318;--badbg:#fdeceb;--info:#1f5f8b;--infobg:#e7f0f8;
--font:"Figtree",-apple-system,BlinkMacSystemFont,"Segoe UI Variable Text","Segoe UI",system-ui,sans-serif;
--shadow:0 1px 2px rgba(15,31,27,.04),0 10px 30px -14px rgba(15,31,27,.14)}
*{box-sizing:border-box}
html{-webkit-text-size-adjust:100%}
body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.55 var(--font);-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale}
.top{position:sticky;top:0;z-index:5;background:rgba(255,255,255,.86);backdrop-filter:saturate(1.6) blur(14px);-webkit-backdrop-filter:saturate(1.6) blur(14px);border-bottom:1px solid var(--line);padding:12px 20px;display:flex;justify-content:space-between;align-items:center;gap:12px}
.top b{display:flex;align-items:center;gap:10px;font-weight:650;font-size:15px;letter-spacing:-.01em}
.top b .mark{width:28px;height:28px}
.top span{font-size:12.5px;font-weight:600;color:var(--teal2);background:#e6efeb;border-radius:999px;padding:4px 12px;white-space:nowrap}
.card{max-width:640px;margin:36px auto;background:var(--paper);border:1px solid var(--line);border-radius:28px;padding:36px;box-shadow:var(--shadow)}
.card.wide{max-width:900px}
h1{font-weight:650;font-size:32px;line-height:1.12;letter-spacing:-.03em;margin:0 0 10px}
h2{font-weight:650;font-size:19px;line-height:1.3;letter-spacing:-.015em;margin:30px 0 10px}
p{margin:6px 0 14px;color:var(--ink2)}.muted{color:var(--muted);font-size:14px}
a{color:var(--teal2);text-underline-offset:3px}
label{display:block;font-weight:600;font-size:14px;margin:18px 0 6px}
input,select,textarea{width:100%;padding:12px 14px;border:1px solid var(--line2);border-radius:14px;font:inherit;font-size:15.5px;background:#fff;color:var(--ink);transition:border-color .15s,box-shadow .15s}
input[type=file]{padding:10px 12px;background:var(--bg)}
input[type=checkbox]{accent-color:var(--teal2)}
textarea{min-height:110px;resize:vertical}
input:focus,select:focus,textarea:focus{outline:0;border-color:var(--teal3);box-shadow:0 0 0 4px rgba(47,122,110,.16)}
.btn:focus-visible,a:focus-visible,button:focus-visible,summary:focus-visible{outline:3px solid rgba(47,122,110,.4);outline-offset:2px}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;background:var(--teal);color:#fff;border:1px solid transparent;border-radius:999px;padding:0 24px;min-height:50px;font:600 15.5px var(--font);cursor:pointer;text-decoration:none;margin-top:18px;text-align:center;transition:background .15s,transform .08s}
.btn:hover{background:#0a2925}.btn:active{transform:scale(.98)}
.btn.go{background:var(--ok)}.btn.go:hover{background:#12623e}
.btn.line{background:#fff;color:var(--ink);border-color:var(--line2)}.btn.line:hover{background:var(--fill)}
.btn.stop{background:#fff;color:var(--bad);border-color:#efc3be}.btn.stop:hover{background:var(--badbg)}
.pill{display:inline-flex;align-items:center;gap:6px;padding:3px 11px 3px 9px;border-radius:999px;font-size:12.5px;font-weight:600;line-height:1.45;white-space:nowrap;vertical-align:1px}
.pill::before{content:"";width:6px;height:6px;border-radius:50%;background:currentColor;flex:none}
.pill.ok{background:var(--okbg);color:var(--ok)}.pill.warn{background:var(--warnbg);color:var(--warn)}.pill.bad{background:var(--badbg);color:var(--bad)}
.pill.info{background:var(--infobg);color:var(--info)}.pill.grey{background:var(--fill);color:var(--muted)}
.callout{border-radius:16px;padding:14px 18px;margin:16px 0;font-size:15px;line-height:1.5}
.callout.ok{background:var(--okbg);color:#0f5132}.callout.warn{background:var(--warnbg);color:#5c3a00}
.callout.bad{background:var(--badbg);color:#7a1a12}.callout.info{background:var(--infobg);color:#173f5f}
table.kv{width:100%;border-collapse:collapse;margin:10px 0}
table.kv td{padding:11px 4px;border-bottom:1px solid var(--line);vertical-align:top;font-size:15px}
table.kv tr:last-child td{border-bottom:0}
table.kv td:first-child{color:var(--muted);width:36%}
table.list{width:100%;border-collapse:collapse;margin:10px 0}
table.list th{font-size:12.5px;color:var(--muted);text-align:left;font-weight:600;padding:8px 8px;border-bottom:1px solid var(--line)}
table.list td{padding:11px 8px;border-bottom:1px solid var(--line);vertical-align:top;font-size:14.5px}
.num{text-align:right;font-variant-numeric:tabular-nums}
.chk{display:grid;grid-template-columns:30px 1fr;gap:10px;padding:12px 0;border-bottom:1px solid var(--line);font-size:15px}
.chk:last-child{border-bottom:0}
.chk .i{width:26px;height:26px;border-radius:50%;display:grid;place-items:center;font-size:13px;font-weight:700}
.chk.ok .i{background:var(--okbg);color:var(--ok)}.chk.warn .i{background:var(--warnbg);color:var(--warn)}.chk.high .i{background:var(--bad);color:#fff}
.chk b{display:block;font-size:15px;font-weight:600}.chk span{color:var(--ink2);font-size:14.5px}
.qcard{display:block;border:1px solid var(--line);border-radius:18px;padding:16px 18px;margin:12px 0;text-decoration:none;color:inherit;background:#fff;transition:border-color .15s,box-shadow .15s}
.qcard:hover{border-color:var(--line2);box-shadow:var(--shadow)}.qcard .t{display:flex;justify-content:space-between;gap:10px;font-weight:650}.qcard .r{margin-top:6px;font-size:14px;color:var(--ink2)}
.stack>form{border-top:1px solid var(--line);padding-top:10px;margin-top:20px}
.stack h3{font-weight:650;font-size:17px;letter-spacing:-.01em;margin:14px 0 2px}
details summary{cursor:pointer}
.sheet h1{font-size:30px}
.sheet table.list td,.sheet table.list th{padding:9px 8px}
.foot{text-align:center;color:var(--muted);font-size:12.5px;margin:12px 16px 40px}
@media(max-width:560px){.card{margin:0;border-radius:0;border-left:0;border-right:0;padding:26px 18px;box-shadow:none}.btn{display:flex;width:100%}.btn.inline{display:inline-flex;width:auto}h1{font-size:27px}}
@media print{.top,.foot,.noprint{display:none!important}body{background:#fff}.card{border:0;margin:0;max-width:none;padding:0;box-shadow:none}}
`;

// A clean, mobile-friendly page for approvers, suppliers, contractors and the certifier.
const page = (title, body, opts = {}) => {
  const cfg = configFrom();
  return `<!doctype html><html lang="en-NZ"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title>${FONT_LINK}<style>${THEME}</style></head><body>
<header class="top"><b>${BRAND_MARK}${esc(cfg.business_name || 'Tussock Ridge Farming Ltd')}</b><span>${esc(opts.tag || 'Secure link')}</span></header>
<main class="card${opts.wide ? ' wide' : ''}">${body}</main>
<div class="foot">Demo by Forrof. All people, businesses and numbers are fictional.</div></body></html>`;
};
