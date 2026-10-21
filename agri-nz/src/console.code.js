// n8n Code node: renders the demo console from the bundle returned by "Load data".
// CONSOLE_CSS is injected by the build script from src/console.css.
const cfg = configFrom();
const base = cfg.base_url;
const q = $('Webhook').first().json.query || {};
const TABS = ['gate', 'invoices', 'plan', 'consents', 'log'];
const tab = TABS.includes(q.tab) ? q.tab : 'gate';
const notice = q.done ? String(q.done) : '';
const today = nzToday();

const invoices = tableRows('Invoices');
const suppliers = Object.fromEntries(tableRows('Suppliers').map((s) => [s.supplier_id, s]));
const farms = tableRows('Farms');
const farmById = Object.fromEntries(farms.map((f) => [f.farm_id, f]));
const evidence = tableRows('Evidence');
const requirements = tableRows('Requirements');
const register = tableRows('Register');
const newest = (a, b) => String(b.created_at || b.at).localeCompare(String(a.created_at || a.at));
const audit = tableRows('Audit log').sort(newest);
const outbox = tableRows('Outbox').sort(newest);
const runs = tableRows('Payment runs').sort(newest);
const supName = (i) => (suppliers[i.supplier_id] || {}).name || '';
const regStates = register.map((r) => ({ r, st: registerState(r, cfg, today) }));

// ---------- line icons, drawn in the current text colour
const ICONS = {
  invoice: '<path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9.5 8h5M9.5 12h5M9.5 16h2.5"/>',
  evidence: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/><path d="M9 14.5l2 2 4-4"/>',
  certificate: '<path d="M12 3l7 3v5.5c0 4.6-3 7.9-7 9.5-4-1.6-7-4.9-7-9.5V6z"/><path d="M9 12l2.2 2.2L15.5 10"/>',
  consent: '<path d="M12 3.5s6 6.4 6 10.9a6 6 0 0 1-12 0C6 9.9 12 3.5 12 3.5z"/>',
  pack: '<path d="M4 20h16"/><path d="M14.5 4.5l5 5L9 20H4v-5z"/>',
  person: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  read: '<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.4-4.4"/>',
  chat: '<path d="M4 5.5h16v10.5H9l-5 4z"/><path d="M8.5 10.5h7"/>',
  hand: '<path d="M8 13V5.5a1.5 1.5 0 0 1 3 0V11m0-1.5V4a1.5 1.5 0 0 1 3 0v6m0-4.5a1.5 1.5 0 0 1 3 0V13c0 4.4-2.7 7-6.5 7-2.9 0-4.4-1.5-5.8-3.6L3.4 12a1.6 1.6 0 0 1 2.6-1.8L8 13"/>',
  log: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  lock: '<rect x="5" y="11" width="14" height="9.5" rx="2.5"/><path d="M8.5 11V7.5a3.5 3.5 0 0 1 7 0V11"/>',
  download: '<path d="M12 4v11M7 10.5l5 5 5-5"/><path d="M5 20h14"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
};
const icon = (name, size = 20) => `<svg class="ic" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name]}</svg>`;

// ---------- small builders
const runForm = (value, label, hint, cls = '') => `<form class="act" method="post" action="${base}/webhook/console/run"><input type="hidden" name="run" value="${value}"><button class="cbtn ${cls}" type="submit">${esc(label)}</button><div class="hint">${esc(hint)}</div></form>`;
// "Mark verified" and "Send back" are separate forms, so pressing Enter in the reason box can only ever send it back.
const verifyForm = (path, id, backTab, fileHref) => {
  const action = `${base}/webhook/${path}/verify`;
  const hidden = `<input type="hidden" name="id" value="${esc(id)}"><input type="hidden" name="tab" value="${backTab}">`;
  return `<div class="vf"><div class="vf-row"><form method="post" action="${action}">${hidden}<input type="hidden" name="action" value="verify"><button class="cbtn sm go" type="submit">${icon('check', 16)}Mark verified</button></form>${fileHref ? `<a class="cbtn sm line" target="_blank" href="${fileHref}">View file</a>` : ''}</div>
<details class="back"><summary>Send it back</summary><form method="post" action="${action}">${hidden}<input type="hidden" name="action" value="back"><input name="reason" placeholder="What needs fixing?" maxlength="200" required aria-label="Reason for sending it back"><button class="cbtn sm line" type="submit">Send back</button></form></details></div>`;
};
const lodgedForm = (r, backTab) => `<form method="post" action="${base}/webhook/register/lodged"><input type="hidden" name="id" value="${esc(r.reg_id)}"><input type="hidden" name="tab" value="${backTab}"><button class="cbtn sm line" type="submit">Record renewal lodged</button></form>`;
const evidenceFile = (it) => (it.file_name && farmById[it.farm_id] ? `${base}/webhook/farmplan/file?p=${farmById[it.farm_id].pack_token}&amp;id=${encodeURIComponent(it.item_id)}` : '');
const registerFile = (r) => (r.file_name ? `${base}/webhook/register/file?t=${r.upload_token}` : '');
// In the demo, this opens the page the agent texted to that person.
const uploadLink = (path, token, name) => `<a class="cbtn sm line" target="_blank" href="${base}/webhook/${path}/upload?t=${token}" title="The upload page the agent sent to ${esc(name)}">Open the link sent to ${esc(firstName(name))}</a>`;
const table = (head, rows, cls = '') => `<div class="scroll"><table class="tbl ${cls}"><thead><tr>${head.map((h) => `<th${h.startsWith('>') ? ' class="num"' : ''}>${esc(h.replace(/^>/, ''))}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table></div>`;
const panel = (title, aside, inner) => `<section class="panel"><header class="ph"><h2>${esc(title)}</h2>${aside ? `<p>${esc(aside)}</p>` : ''}</header>${inner}</section>`;
const hero = (eyebrow, title, lede, aside = '') => `<section class="hero"><div class="hero-text"><div class="eyebrow">${eyebrow}</div><h1>${title.replace(/<br>/g, ' <br>')}</h1><p class="lede">${lede}</p></div>${aside ? `<div class="hero-aside">${aside}</div>` : ''}</section>`;
const fact = (label, value) => `<div><div class="l">${esc(label)}</div><div class="v">${value}</div></div>`;
const empty = (text) => `<div class="empty">${text}</div>`;
const counted = (n, one, many) => `${n} ${n === 1 ? one : many}`;

// ---------- what is waiting for a person
const gate = [];
const task = (group, rank, ic, tone, title, sub, why, who, act) => gate.push({ group, rank, html: `<li class="task"><div class="tk-ic ${tone}">${icon(ic, 22)}</div><div class="tk-main"><div class="tk-title">${title}</div>${sub ? `<div class="tk-sub">${sub}</div>` : ''}<div class="tk-why">${why}</div><div class="tk-who">${icon('person', 14)}${esc(who)}</div></div><div class="tk-act">${act}</div></li>` });
for (const i of invoices.filter((x) => ['matched', 'flagged'].includes(x.status))) {
  const failed = failedChecks(i);
  task('invoice', failed.length ? 0 : 1, 'invoice', failed.length ? 'warn' : 'ok', `${esc(supName(i))}<span class="amt">${money(i.total)}</span>`, `${esc(i.description)}, invoice ${esc(i.supplier_ref)}`,
    failed.length ? `${pill('warn', 'Flagged')} ${esc(failed[0].text)}` : `${pill('ok', 'All checks passed')} It only needs a yes.`,
    `${i.approver_name} (${approverFor(i.approver_role, cfg).title}) decides`, `<a class="cbtn sm" target="_blank" href="${base}/webhook/invoices/review?t=${i.review_token}">Open the decision</a>`);
}
for (const f of farms.filter((x) => x.pack_status === 'Ready for sign-off')) {
  task('pack', 0, 'pack', 'info', `Evidence pack for ${esc(f.name)}`, `All ${farmItems(f, evidence).length} items verified`, `${pill('info', 'Drafted')} The agent built the pack from verified records. Nothing goes to ${esc(cfg.certifier_name)} until it is signed.`,
    `${cfg.owner_name} (owner) signs`, `<a class="cbtn sm go" target="_blank" href="${base}/webhook/farmplan/signoff?t=${f.signoff_token}">Review and sign off</a><a class="lnk" target="_blank" href="${base}/webhook/farmplan/pack?t=${f.pack_token}">View the pack</a>`);
}
for (const x of regStates.filter((y) => y.r.status !== 'received' && ['expired', 'late', 'urgent', 'missing', 'lodge'].includes(y.st.state))) {
  const r = x.r;
  const consent = r.kind === 'Consent';
  const act = consent && ['lodge', 'late', 'expired'].includes(x.st.state) ? lodgedForm(r, 'gate') : uploadLink('register', r.upload_token, r.responsible_name);
  task('record', x.st.state === 'lodge' ? 1 : 0, consent ? 'consent' : 'certificate', x.st.tone, esc(r.type), esc(r.responsible_name), `${pill(x.st.tone, x.st.label)} ${esc(x.st.detail)}`,
    consent ? `${cfg.owner_name} (owner) acts` : `${cfg.manager_name} (operations manager) acts`, act);
}
for (const it of evidence.filter((e) => e.status === 'received')) {
  const farm = farmById[it.farm_id] || {};
  task('upload', 0, 'evidence', 'info', esc(it.requirement), `${esc(farm.name)}, uploaded ${esc(ago(it.received_at))} by ${esc(it.provider_name)}`, `${pill('info', 'Check needed')} A person confirms it is the right document.`,
    `${farm.manager_name} (farm manager) checks`, verifyForm('farmplan', it.item_id, 'gate', evidenceFile(it)));
}
for (const x of regStates.filter((y) => y.r.status === 'received')) {
  const r = x.r;
  task('upload', 0, 'certificate', 'info', esc(r.type), `${esc(r.responsible_name)}, uploaded ${esc(ago(r.received_at))}`, `${pill('info', 'Check needed')} New expiry date ${esc(fmtDate(r.new_expiry))}.`,
    `${cfg.admin_name} (admin) checks`, verifyForm('register', r.reg_id, 'gate', registerFile(r)));
}
const inGroup = (group) => gate.filter((g) => g.group === group).length;

// ---------- numbers used across the tabs
const heldBack = round2(invoices.filter((i) => ['flagged', 'queried', 'rejected'].includes(i.status)).reduce((s, i) => s + Number(i.at_risk || 0), 0));
const wholeDollars = (n) => '$' + Math.round(n).toLocaleString('en-NZ');
const checkedCount = invoices.filter((i) => i.checked_at).length;
const sentCount = evidence.reduce((n, e) => n + Number(e.requests_sent || 0), 0) + register.reduce((n, r) => n + Number(r.reminders_sent || 0), 0);
const packsDrafted = farms.filter((f) => f.ready_at).length;
const pendingInvoices = invoices.filter((i) => ['received', 'matched', 'flagged'].includes(i.status)).length;
const verifiedCount = evidence.filter((e) => e.status === 'verified').length;
const openEvidence = evidence.length - verifiedCount;
const daysToGo = Math.max(0, daysBetween(today, cfg.plan_deadline));
const cnt = (...s) => regStates.filter((x) => s.includes(x.st.state)).length;
const needAction = cnt('expired', 'late', 'urgent', 'missing', 'lodge', 'soon', 'plan');

// ---------- top bar
const tabLink = (id, label, n) => `<a href="${base}/webhook/console?tab=${id}" class="${tab === id ? 'on' : ''}${id === 'gate' && n ? ' hot' : ''}"${tab === id ? ' aria-current="page"' : ''}>${label}${n ? `<span class="c">${n}</span>` : ''}</a>`;
const nav = `<header class="nav"><div class="in">
<a class="brand" href="${base}/webhook/console">${BRAND_MARK}<span><b>${esc(cfg.business_name)}</b><small>Farm admin agent, ${esc(cfg.region)}</small></span></a>
<nav class="tabs" aria-label="Sections">${tabLink('gate', 'Today', gate.length)}${tabLink('invoices', 'Invoices', pendingInvoices)}${tabLink('plan', 'Farm plan', openEvidence)}${tabLink('consents', 'Consents and certificates', needAction)}${tabLink('log', 'History', 0)}</nav>
<form class="side" method="post" action="${base}/webhook/console/run"><input type="hidden" name="run" value="reset"><button class="rst" type="submit" title="Puts every invoice, upload and record back to Monday morning">Reset demo</button></form>
</div></header>`;

// ---------- tab: today
const hr = Number(new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', hourCycle: 'h23' }).format(new Date()));
const greeting = hr < 12 ? 'Good morning.' : hr < 18 ? 'Good afternoon.' : 'Good evening.';
const parts = [];
if (inGroup('invoice')) parts.push(`${counted(inGroup('invoice'), 'invoice', 'invoices')} to decide`);
if (inGroup('pack')) parts.push(`${counted(inGroup('pack'), 'pack', 'packs')} to sign`);
if (inGroup('record')) parts.push(`${counted(inGroup('record'), 'record', 'records')} needing action`);
if (inGroup('upload')) parts.push(`${counted(inGroup('upload'), 'upload', 'uploads')} to check`);
const contour = '<svg class="contour" viewBox="0 0 400 260" preserveAspectRatio="xMaxYMax slice" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="1"><path d="M0 230C70 190 130 250 200 205S330 150 400 190"/><path d="M0 205C75 160 140 225 210 178S335 120 400 160"/><path d="M0 180C80 132 150 198 220 150S340 92 400 130"/><path d="M0 155C85 104 160 172 230 122S345 64 400 100"/><path d="M0 255C65 220 120 270 190 232S325 180 400 220"/></g></svg>';
const zones = `<section class="zones" aria-label="Today at a glance">
<div class="zone"><h2>${icon('check', 18)}Done by the agent alone</h2><ul class="lines">
<li><span>Invoices read and matched</span><b>${checkedCount}</b></li>
<li><span>Requests and reminders sent</span><b>${sentCount}</b></li>
<li><span>Records watched for expiry</span><b>${register.length}</b></li>
<li><span>Evidence packs drafted</span><b>${packsDrafted}</b></li>
<li><span>Held back for a human look</span><b>${wholeDollars(heldBack)}</b></li></ul></div>
<div class="zone gate">${contour}<h2>${icon('hand', 18)}Waiting for a person's yes</h2><div class="big"><span class="n">${gate.length}</span></div>
<p class="what">${gate.length ? `${esc(parts.join(', '))}. The agent has stopped at each one.` : 'Nothing is waiting. Every decision has a name against it.'}</p>
${gate.length ? `<a class="zbtn" href="#waiting">See what is waiting ${icon('arrow', 16)}</a>` : ''}</div>
<div class="zone"><h2>${icon('log', 18)}Every step logged</h2><ul class="lines"><li><span>Entries in the log</span><b>${audit.length}</b></li></ul>
<ul class="lines log">${audit.slice(0, 3).map((a) => `<li><span class="t">${esc(ago(a.at))}</span><span>${esc(a.actor)}: ${esc(a.action)}</span></li>`).join('')}</ul>
<a class="more-link" href="${base}/webhook/console?tab=log">Open the full history ${icon('arrow', 15)}</a></div></section>`;

const GROUPS = [['invoice', 'Invoices to decide'], ['pack', 'Evidence packs to sign'], ['record', 'Consents and certificates to sort out'], ['upload', 'Uploads to check']];
const waiting = GROUPS.map(([g, title]) => {
  const items = gate.filter((x) => x.group === g).sort((a, b) => a.rank - b.rank);
  return items.length ? `<div class="group"><h3>${esc(title)}<span>${items.length}</span></h3><ul class="tasks">${items.map((x) => x.html).join('')}</ul></div>` : '';
}).join('');

const areaCard = (id, ic, title, text, status) => `<a class="area" href="${base}/webhook/console?tab=${id}"><span class="a-ic">${icon(ic, 24)}</span><h3>${title}</h3><p>${text}</p><span class="a-st">${status}${icon('arrow', 16)}</span></a>`;
const areas = `<div class="areas">
${areaCard('invoices', 'invoice', 'Supplier invoices', 'Checks every invoice against its contract, the delivery docket and the bank account on file, then asks the right person to approve it.', pendingInvoices ? `${pendingInvoices} open${heldBack ? `, ${wholeDollars(heldBack)} held back` : ''}` : 'Nothing open')}
${areaCard('plan', 'evidence', 'Farm plan evidence', `Chases consultants and contractors for missing evidence and drafts the pack for the certifier. Due ${esc(fmtDate(cfg.plan_deadline))}.`, `${verifiedCount} of ${evidence.length} verified, ${daysToGo} days to go`)}
${areaCard('consents', 'certificate', 'Consents and certificates', 'Watches every resource consent, staff certificate, vehicle check and insurance date, and reminds people before they run out.', `${cnt('expired')} expired, ${cnt('urgent', 'soon')} expiring soon`)}</div>`;

const steps = `<ol class="steps">
<li><span class="s-ic">${icon('read', 22)}</span><span class="s-n">Step 1</span><h3>It reads and checks</h3><p>Supplier invoices, uploaded evidence, consents and certificates. Every day, without being asked.</p></li>
<li><span class="s-ic">${icon('chat', 22)}</span><span class="s-n">Step 2</span><h3>It chases people</h3><p>A text or an email with a secure link. No app and no login. After ${esc(cfg.max_requests)} tries it stops, so a person can phone.</p></li>
<li><span class="s-ic">${icon('hand', 22)}</span><span class="s-n">Step 3</span><h3>A person says yes</h3><p>Nothing is paid, sent or signed until a named person decides. Every step is written to the log.</p></li></ol>`;
const guardrails = `<div class="rails">
<div class="rail"><h3>${icon('check', 18)}The agent does alone</h3><ul>
<li>Reads each invoice and matches it to its contract and delivery docket, with 7 checks.</li>
<li>Chases evidence, certificates and consents by SMS and email, and stops after ${esc(cfg.max_requests)} requests.</li>
<li>Drafts the evidence pack from records a person has verified.</li>
<li>Prepares the payment file for your bank.</li>
<li>Writes every step to the log.</li></ul></div>
<div class="rail yes"><h3>${icon('lock', 18)}Only a person can</h3><ul>
<li>Approve an invoice. The owner decides anything over ${wholeDollars(Number(cfg.manager_limit))} and everything flagged.</li>
<li>Approve a flagged invoice anyway, and only with a written reason.</li>
<li>Send a question to a supplier, or sign off a pack for the certifier.</li>
<li>Pay anyone. The agent has no bank access, and payments always use the account on file.</li>
<li>Mark evidence verified, or change the checklist or the due date.</li></ul></div></div>`;

const todayTab = `<section class="hero home"><div class="hero-text"><div class="eyebrow">${esc(fmtLong(today))}</div>
<h1>${greeting}<br><em>${gate.length ? `${gate.length} ${gate.length === 1 ? 'thing needs' : 'things need'} a person.` : 'Nothing needs a person.'}</em></h1>
<p class="lede">The agent reads the supplier invoices, chases the farm plan paperwork and watches every consent and certificate. Wherever a person has to decide, it stops and waits.</p></div></section>
${zones}
<section class="sec" id="waiting"><div class="sec-h"><div><h2>Waiting for a person</h2><p>The agent has done its part on each of these and stopped.</p></div></div>
${waiting || empty('Nothing is waiting. Run a check from the Invoices, Farm plan or Consents tabs and the decisions appear here.')}</section>
<section class="sec"><div class="sec-h"><div><h2>What the agent looks after</h2><p>Three jobs that eat a farm office's week.</p></div></div>${areas}</section>
<section class="sec"><div class="sec-h"><div><h2>How it works</h2><p>The agent does the dull parts. A person signs off anything sent or paid. Every step is logged.</p></div></div>${steps}${guardrails}</section>`;

// ---------- tab: supplier invoices
const statusRank = { received: 0, flagged: 1, matched: 2, queried: 3, approved: 4, rejected: 5, scheduled: 6, paid: 7 };
const sortedInvoices = [...invoices].sort((a, b) => (statusRank[a.status] ?? 9) - (statusRank[b.status] ?? 9) || String(a.invoice_date).localeCompare(String(b.invoice_date)) || a.invoice_id.localeCompare(b.invoice_id));
const checksCell = (i) => {
  if (i.status === 'received') return '<span class="muted">Not checked yet</span>';
  const failed = failedChecks(i);
  if (!failed.length) return i.status === 'paid' ? '<span class="muted">All passed</span>' : pill('ok', `All ${parseChecks(i).length || 7} passed`);
  const override = i.decision === 'approved anyway' ? `<div class="muted">Approved anyway: ${esc(i.decision_note)}</div>` : '';
  return `${failed.map((c) => `<div class="flag ${c.level === 'high' ? 'high' : ''}"><b>!</b><span>${esc(c.short || c.label)}</span></div>`).join('')}${i.at_risk ? `<div class="risk">${money(i.at_risk)} at stake</div>` : ''}${override}`;
};
const invoiceRows = sortedInvoices.map((i) => `<tr class="${i.status === 'paid' ? 'dim' : ''}"><td><b>${esc(supName(i))}</b><div class="muted">${esc(i.supplier_ref)}, ${esc(i.invoice_id)}</div></td>
<td>${esc(i.description)}<div class="muted">${i.contract_id ? `Contract ${esc(i.contract_id)}, due` : 'Due'} ${esc(fmtDate(i.due_date))}</div></td><td class="num"><b>${money(i.total)}</b></td><td>${checksCell(i)}</td>
<td>${invoiceStatusPill(i)}${i.approver_name ? `<div class="muted">${esc(i.approver_name)} ${['matched', 'flagged'].includes(i.status) ? 'decides' : 'decided'}</div>` : ''}</td>
<td class="acts">${['matched', 'flagged'].includes(i.status) ? `<a class="cbtn sm" target="_blank" href="${base}/webhook/invoices/review?t=${i.review_token}">Open decision</a>` : ''}${i.review_token ? `<a class="lnk" target="_blank" href="${base}/webhook/invoices/copy?t=${i.review_token}">View invoice</a>` : ''}</td></tr>`).join('');
const approvedOpen = invoices.filter((i) => i.status === 'approved' && !i.payment_file);
const runRows = runs.map((r) => `<tr><td>${esc(fmtTime(r.created_at))}</td><td>${esc(r.file_name)}</td><td>${esc(fmtDate(r.pay_date))}</td><td class="num">${r.invoices}</td><td class="num"><b>${money(r.total)}</b></td><td class="acts"><a class="cbtn sm line" href="${base}/webhook/payments/file?name=${encodeURIComponent(r.file_name)}">${icon('download', 16)}Download CSV</a></td></tr>`).join('');
const invoicesTab = `${hero('Supplier invoices', 'Every invoice checked<br>before anyone pays it.', `The agent matches each invoice to its contract and delivery docket and runs seven checks: contract, price, volume, docket, GST, duplicates and bank account. A person approves every invoice. The agent has no bank access.`,
  `${runForm('check', 'Check new invoices', 'Runs the 7 checks on every new invoice and asks the right person to decide.')}
${runForm('payments', 'Build payment file', `Puts approved invoices due by ${fmtDate(nextPayDate(today, Number(cfg.pay_day || 20)))} into one bank file. Nothing is paid.`, 'line')}
<div class="act"><a class="cbtn line" href="${base}/webhook/invoices/new">${icon('plus', 16)}Add an invoice</a><div class="hint">Key one in and watch it get checked. Try a price 10% over the contract.</div></div>`)}
<div class="facts">${fact('New, not checked yet', invoices.filter((i) => i.status === 'received').length)}${fact('Waiting for a decision', invoices.filter((i) => ['matched', 'flagged'].includes(i.status)).length)}${fact('Held back or stopped', money(heldBack))}${fact('Approved, not in a payment file', `${money(round2(approvedOpen.reduce((s, i) => s + Number(i.total), 0)))}`)}</div>
${panel('All invoices', `Paid on the ${cfg.pay_day}th of the month following. GST is ${Math.round(Number(cfg.gst_rate) * 100)}%.`, table(['Supplier', 'For', '>Total', 'What the agent found', 'Status', ''], invoiceRows, 'inv'))}
${panel('Payment files', 'The agent prepares the file. A person uploads it to the bank.', runRows ? table(['Prepared', 'File', 'Pay date', '>Invoices', '>Total', ''], runRows) : empty('No payment files yet. Approve some invoices, then press Build payment file.'))}`;

// ---------- tab: farm plan evidence
const SEG = { verified: '#18794e', received: '#3b82c4', requested: '#e0a21b', missing: '#d64535' };
const legend = `<div class="legend">${[['verified', 'Verified'], ['received', 'To check'], ['requested', 'Requested'], ['missing', 'Missing']].map(([k, l]) => `<span><i style="background:${SEG[k]}"></i>${l}</span>`).join('')}</div>`;
const farmBlock = (f) => {
  const mine = farmItems(f, evidence);
  const c = evidenceCounts(mine);
  const bar = `<div class="prog" role="img" aria-label="${c.verified} verified, ${c.received} to check, ${c.requested} requested, ${c.missing} missing">${['verified', 'received', 'requested', 'missing'].map((k) => (c[k] ? `<i style="width:${(c[k] / c.total) * 100}%;background:${SEG[k]}" title="${c[k]} ${k}"></i>` : '')).join('')}</div>`;
  const row = (it) => {
    let act = '';
    if (it.status === 'missing' || it.status === 'requested') act = uploadLink('farmplan', it.upload_token, it.provider_name);
    if (it.status === 'received') act = verifyForm('farmplan', it.item_id, 'plan', evidenceFile(it));
    if (it.status === 'verified' && it.file_name) act = `<a class="lnk" target="_blank" href="${evidenceFile(it)}">View file</a>`;
    return `<tr><td><b>${esc(it.requirement)}</b><div class="muted">${esc(it.category)}</div></td><td>${esc(it.provider_name)}</td><td>${evidencePill(it)}${Number(it.requests_sent) ? `<div class="muted">${it.requests_sent} request${Number(it.requests_sent) === 1 ? '' : 's'} sent</div>` : ''}${it.status === 'requested' && it.note ? `<div class="muted">Sent back: ${esc(it.note)}</div>` : ''}</td><td class="acts">${act}</td></tr>`;
  };
  const open = mine.filter((it) => it.status !== 'verified');
  const done = mine.filter((it) => it.status === 'verified');
  const head = ['Evidence', 'Supplied by', 'Status', ''];
  const links = `${f.pack_status === 'Ready for sign-off' ? `<a class="cbtn sm go" target="_blank" href="${base}/webhook/farmplan/signoff?t=${f.signoff_token}">Review and sign off</a>` : ''}<a class="lnk" target="_blank" href="${base}/webhook/farmplan/pack?t=${f.pack_token}">View the pack</a>${f.pack_status === 'Sent to certifier' ? `<div class="muted">Signed off by ${esc(f.signed_by)} ${esc(ago(f.signed_at))}, sent to ${esc(f.sent_to)}.</div>` : ''}`;
  return `<div class="farm"><div class="hdr"><div><h3>${esc(f.name)}</h3><div class="muted">${esc(f.farm_type)}, ${Number(f.area_ha).toLocaleString('en-NZ')} ha, ${esc(f.location)}. Manager: ${esc(f.manager_name)}</div><div class="flinks">${links}</div></div>
<div class="fstat">${packPill(f)}<div class="fnum">${c.verified} of ${c.total} verified</div>${bar}</div></div>
${open.length ? table(head, open.map(row).join('')) : '<div class="allset">Every item is verified.</div>'}
${done.length ? `<details class="more"><summary>${done.length} verified item${done.length === 1 ? '' : 's'}</summary>${table(head, done.map(row).join(''))}</details>` : ''}</div>`;
};
const typeOptions = [...new Set(farms.map((f) => f.farm_type))];
const planTab = `${hero('Farm plan evidence', 'Farm plan evidence,<br>chased and collected.', `Certified freshwater farm plans for ${esc(cfg.region)} are due ${esc(fmtDate(cfg.plan_deadline))}. The agent asks consultants and contractors for what is missing, a person checks every upload, and the owner signs each pack before it goes to the certifier.`,
  runForm('chase', 'Chase missing evidence', `Asks each provider for what is missing, reminds after ${cfg.reminder_days} days and stops at ${cfg.max_requests} requests, so a person can phone.`))}
<div class="facts">${fact('Due date for certified plans', esc(fmtDate(cfg.plan_deadline)))}${fact('Days to go', daysToGo)}${fact('Evidence verified', `${verifiedCount} of ${evidence.length}`)}${fact('Packs ready or sent', `${farms.filter((f) => f.pack_status !== 'Collecting').length} of ${farms.length}`)}</div>
<section class="panel"><header class="ph"><h2>Farms</h2>${legend}</header>${farms.map(farmBlock).join('')}</section>
<section class="panel"><header class="ph"><h2>The rules keep moving</h2><p>Change a setting once. The countdowns, the checklist and every open pack follow.</p></header><div class="rules">
<div><h3>Due date for certified plans</h3><p class="muted">${esc(cfg.plan_deadline_note)}</p>
<form method="post" action="${base}/webhook/farmplan/deadline"><input type="hidden" name="tab" value="plan"><label for="deadline">New due date</label><input id="deadline" name="deadline" type="date" value="${esc(cfg.plan_deadline)}" required><button class="cbtn" type="submit">Change the due date</button></form></div>
<div><h3>Checklist</h3><p class="muted">An example set of ${requirements.length} items. Confirm what a plan needs with your certifier.</p>
<details class="more inline"><summary>See the ${requirements.length} items</summary><ul class="reqs">${requirements.map((r) => `<li>${esc(r.requirement)}</li>`).join('')}</ul></details>
<form method="post" action="${base}/webhook/farmplan/rule"><input type="hidden" name="tab" value="plan"><label for="requirement">Add a requirement</label><input id="requirement" name="requirement" placeholder="For example: Updated stock exclusion map" required>
<div class="pair"><div><label for="category">Category</label><input id="category" name="category" value="Environment"></div><div><label for="applies_to">Applies to</label><select id="applies_to" name="applies_to"><option>All</option>${typeOptions.map((t) => `<option>${esc(t)}</option>`).join('')}</select></div></div>
<button class="cbtn" type="submit">Add to the checklist</button></form></div></div></section>`;

// ---------- tab: consents and certificates
const sortedRegs = [...regStates].sort((a, b) => REG_RANK[a.st.state] - REG_RANK[b.st.state] || String(a.r.expiry_date).localeCompare(String(b.r.expiry_date)));
const regRows = sortedRegs.map(({ r, st }) => {
  let act = '';
  if (r.status === 'received') act = verifyForm('register', r.reg_id, 'consents', registerFile(r));
  else {
    if (regNeedsAction(st.state) || r.status === 'missing' || r.status === 'requested') act += uploadLink('register', r.upload_token, r.responsible_name);
    if (r.kind === 'Consent' && !r.renewal_lodged_at && ['plan', 'lodge', 'late'].includes(st.state)) act += lodgedForm(r, 'consents');
    if (r.file_name && !act) act = `<a class="lnk" target="_blank" href="${registerFile(r)}">View file</a>`;
  }
  const farm = farmById[r.farm_id];
  const kindIcon = r.kind === 'Consent' ? 'consent' : 'certificate';
  return `<tr class="${st.state === 'ok' ? 'dim' : ''}"><td><div class="rec"><span class="r-ic ${st.tone}">${icon(kindIcon, 18)}</span><div><b>${esc(r.type)}</b><div class="muted">${esc(r.kind)}${r.reference ? `, ${esc(r.reference)}` : ''}${farm ? `, ${esc(farm.name)}` : ''}</div></div></div></td><td class="nowrap">${esc(r.responsible_name)}</td>
<td class="num">${r.expiry_date ? esc(fmtDate(r.expiry_date)) : '—'}${r.status === 'received' && r.new_expiry ? `<div class="muted">New: ${esc(fmtDate(r.new_expiry))}</div>` : ''}</td>
<td class="where">${r.status === 'received' ? `${pill('info', 'Check needed')} ` : ''}${pill(st.tone, st.label)}<div class="muted">${esc(st.detail)}</div></td><td class="acts">${act}</td></tr>`;
}).join('');
const consentsTab = `${hero('Consents and certificates', 'No more surprise<br>expiry dates.', `The agent watches every resource consent, staff certificate, vehicle check and insurance date. It reminds the person responsible on a tightening schedule, and tells the operations manager what not to assign until it is sorted.`,
  runForm('watch', 'Check every expiry date', 'Works out where each record stands, reminds the person responsible, and flags what not to assign until it is sorted.'))}
<div class="facts">${fact('Expired', cnt('expired'))}${fact(`Expiring within ${cfg.cert_soon_days} days`, cnt('urgent', 'soon'))}${fact('Consent renewals to action', cnt('plan', 'lodge', 'late'))}${fact('No evidence on file', cnt('missing'))}${fact('Current', cnt('ok', 'lodged'))}</div>
${panel('All records', `Consent renewals follow section 124 of the Resource Management Act: lodge at least ${cfg.consent_lodge_months} months before expiry to keep operating while the council decides.`,
  table(['Record', 'Responsible', '>Expires', 'Where it stands', ''], regRows))}`;

// ---------- tab: history (log and messages)
const who = ['agent', 'person'].includes(q.who) ? q.who : '';
const flow = ['Invoices', 'Payments', 'Farm plan', 'Consents'].includes(q.flow) ? q.flow : '';
const chip = (label, params, on) => `<a class="chip${on ? ' on' : ''}" href="${base}/webhook/console?tab=log${params}">${label}</a>`;
const shown = audit.filter((a) => (!who || a.actor_type === who) && (!flow || a.flow === flow)).slice(0, 60);
const auditRows = shown.map((a) => `<tr><td class="muted nowrap">${esc(fmtTime(a.at))}</td><td><span class="who ${esc(a.actor_type)}">${esc(a.actor_type === 'agent' ? 'Agent' : a.actor_type === 'person' ? a.actor : 'System')}</span></td><td>${esc(a.flow)}</td><td>${esc(a.subject)}</td><td><b>${esc(a.action)}</b><div class="muted">${esc(a.detail)}</div></td></tr>`).join('');
const outRows = outbox.slice(0, 40).map((m) => `<tr><td class="muted nowrap">${esc(fmtTime(m.created_at))}</td><td><span class="ch ${m.channel === 'SMS' ? 'sms' : 'email'}">${esc(m.channel)}</span></td><td><b>${esc(m.to_name)}</b><div class="muted">${esc(m.to_address)}</div></td>
<td class="msg">${m.subject ? `<b>${esc(m.subject)}</b><br>` : ''}${String(m.body).length > 240 ? `<span class="pre">${esc(String(m.body).slice(0, 240))}…</span><details><summary class="lnk">Show the whole message</summary><div class="pre">${esc(m.body)}</div></details>` : `<span class="pre">${esc(m.body)}</span>`}${m.link ? `<br><a class="lnk" target="_blank" href="${esc(m.link)}">Open the link in this message</a>` : ''}</td><td class="muted">${esc(m.workflow)}<div>${esc(m.delivery)}</div></td></tr>`).join('');
const logTab = `${hero('History', 'Every step,<br>on the record.', 'Who did what, to what, and when: the agent or a named person. Nothing the agent does is off the record, and you can hand the whole log to your auditor, certifier or bank.',
  `<div class="act"><a class="cbtn line" href="${base}/webhook/audit/csv">${icon('download', 16)}Download the whole log (CSV)</a><div class="hint">${audit.length} entries, in New Zealand time.</div></div>`)}
${panel('Audit trail', 'Newest first.', `<div class="filters"><div class="seg">${chip('Everyone', '', !who && !flow)}${chip('The agent', '&amp;who=agent', who === 'agent')}${chip('People', '&amp;who=person', who === 'person')}</div><div class="seg">${['Invoices', 'Payments', 'Farm plan', 'Consents'].map((f) => chip(f, `&amp;flow=${encodeURIComponent(f)}`, flow === f)).join('')}</div></div>
${table(['When', 'Who', 'Area', 'Subject', 'What happened'], auditRows || '<tr><td colspan="5" class="muted">Nothing logged yet.</td></tr>')}`)}
${panel('Messages', cfg.sms_enabled === 'true' || cfg.email_enabled === 'true' ? 'Live sending is on.' : 'Demo mode: messages are logged here and not sent.', table(['When', 'Channel', 'To', 'Message', 'Sent by'], outRows || '<tr><td colspan="5" class="muted">No messages yet. Run an automation.</td></tr>'))}`;

const body = { gate: todayTab, invoices: invoicesTab, plan: planTab, consents: consentsTab, log: logTab }[tab];
const html = `<!doctype html><html lang="en-NZ"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(cfg.business_name)}: farm admin agent</title>${FONT_LINK}<style>${THEME}${CONSOLE_CSS}</style></head><body>
${nav}<main class="wrap">
${notice ? `<div class="notice" role="status"><span class="n-ic">${icon('check', 16)}</span><div>${esc(notice)}</div><a class="n-x" href="${base}/webhook/console?tab=${tab}" aria-label="Dismiss">&times;</a></div>` : ''}
${body}
<footer class="end"><div>${BRAND_MARK}<span>Built by Forrof. Runs on n8n.</span></div><p>All people, businesses, bank accounts and numbers are fictional. The agent checks, drafts and chases. People decide, approve and sign. Consent renewal rules follow section 124 of the Resource Management Act and farm plan dates follow the Ministry for the Environment (May 2026). Both are settings: confirm them with your adviser.</p></footer>
</main></body></html>`;
return [{ json: { html } }];
