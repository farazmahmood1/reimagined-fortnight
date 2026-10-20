// Browser code for the applications page. Real data comes from the JSON block the Code node embeds;
// demo mode (?demo=1) runs the full sample agency workspace from inbox-sample.client.js, saved in
// this browser only. Pages: dashboard, jobs, job detail, applications, talent pool, interviews, outbox.
(() => {
  const S = JSON.parse(document.getElementById('state').textContent);
  const SAMPLE_MODE = !!S.sample;
  const STORE = 'forrof-sample-v4';
  const PAGE_SIZE = 25;
  const DATE_KEYS = new Set(['at', 'openedAt', 'closesAt', 'lastContact', 'aiAt']);

  // ================================================================== data
  // n8n serves webhook pages sandboxed (no same-origin), so browser storage is usually blocked and
  // the sample workspace starts fresh on each reload. Where storage works, saved data is shifted
  // forward by the time since it was saved, so "3 h ago" stays true.
  const shiftDates = (node, delta) => {
    if (Array.isArray(node)) { node.forEach((x) => shiftDates(x, delta)); return; }
    if (!node || typeof node !== 'object') return;
    for (const [k, v] of Object.entries(node)) {
      if (DATE_KEYS.has(k) && typeof v === 'string' && /^\d{4}-\d\d-\d\dT/.test(v)) node[k] = new Date(new Date(v).getTime() + delta).toISOString();
      else if (v && typeof v === 'object') shiftDates(v, delta);
    }
  };
  const loadSample = () => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORE) || 'null');
      if (saved && saved.db && saved.db.version === 4) { shiftDates(saved.db, Date.now() - saved.savedAt); return saved.db; }
    } catch { /* storage unavailable or damaged: start fresh */ }
    return buildSampleWorkspace();
  };
  const DB = SAMPLE_MODE ? loadSample()
    : { candidates: JSON.parse(document.getElementById('data').textContent), jobs: [], clients: [], team: [], pool: [], outbox: [], automations: {} };
  const save = () => { if (!SAMPLE_MODE) return; try { localStorage.setItem(STORE, JSON.stringify({ savedAt: Date.now(), db: DB })); } catch { /* storage full or blocked */ } };
  save();
  const APPS = DB.candidates;
  const rescore = (a) => { a.score = matchScore(a); a.tier = matchTier(a.score); };
  APPS.forEach(rescore);
  DB.pool.forEach(rescore);

  const JOB = (id) => DB.jobs.find((j) => j.id === id);
  const CLIENT = (id) => DB.clients.find((c) => c.id === id);
  const USER = (id) => DB.team.find((u) => u.id === id);
  const ME = USER(DB.me) || { id: 'me', name: 'You', title: '' };
  const jobOf = (c) => JOB(c.jobId);
  const clientOf = (c) => { const j = jobOf(c); return j ? CLIENT(j.clientId) : null; };
  const firstOf = (n) => String(n || '').split(' ')[0];
  const byName = (id) => (id === 'system' ? 'Forrof automation' : id === ME.id ? 'You' : (USER(id) || { name: 'Someone' }).name);

  // ================================================================== helpers
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const notStated = (v) => !v || /^not stated/i.test(String(v).trim());
  const TZ = 'Europe/London';
  const fmt = (d, o) => (d ? new Date(d).toLocaleString('en-GB', { timeZone: TZ, ...o }) : '');
  const day = (d) => fmt(d, { day: 'numeric', month: 'short', year: 'numeric' });
  const when = (d) => fmt(d, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  const time = (d) => fmt(d, { hour: '2-digit', minute: '2-digit' });
  const longDay = (d) => fmt(d, { weekday: 'long', day: 'numeric', month: 'long' });
  const ago = (d) => {
    if (!d) return '';
    const mins = Math.floor((Date.now() - new Date(d)) / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins} min ago`;
    if (mins < 1440) return `${Math.floor(mins / 60)} h ago`;
    const days = Math.floor(mins / 1440);
    if (days === 1) return 'Yesterday';
    if (days < 30) return `${days} days ago`;
    if (days < 365) return `${Math.round(days / 30)} months ago`;
    return `${(days / 365).toFixed(1).replace('.0', '')} years ago`;
  };
  const until = (d) => {
    const days = Math.ceil((new Date(d) - Date.now()) / 86400000);
    if (days < 0) return `closed ${-days} day${days === -1 ? '' : 's'} ago`;
    if (days === 0) return 'closes today';
    return `closes in ${days} day${days === 1 ? '' : 's'}`;
  };
  const initials = (n) => String(n || '?').replace(/[^A-Za-zÀ-ž ]/g, ' ').trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '?';
  const TINTS = [['#f3effd', '#5b34c7'], ['#eff6ff', '#1d4ed8'], ['#ecfdf5', '#047857'], ['#fff7ed', '#c2410c'], ['#fdf2f8', '#be185d'], ['#f0f9ff', '#0369a1'], ['#fefce8', '#a16207'], ['#f1f5f9', '#334155']];
  const tint = (s) => TINTS[[...String(s)].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7) % TINTS.length];
  const avatar = (a, cls = '') => { const [bg, fg] = tint(a.id); return `<div class="av ${cls}" style="background:${bg};color:${fg}">${esc(initials(a.name))}</div>`; };
  const USER_COLOURS = { u1: '#6e41e2', u2: '#0e7490', u3: '#be185d', u4: '#c2410c' };
  const userAv = (id, cls = '') => { const u = USER(id); if (!u) return ''; return `<span class="uav ${cls}" style="background:${USER_COLOURS[id] || '#475569'}" title="${esc(u.name)}">${esc(initials(u.name))}</span>`; };
  const clientMark = (c, cls = '') => { const [bg, fg] = tint(c.id + c.name); return `<div class="cmark ${cls}" style="background:${bg};color:${fg}">${esc(initials(c.name))}</div>`; };
  const svg = (d) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
  const I = {
    grid: svg('<rect width="7" height="9" x="3" y="3" rx="1"/><rect width="7" height="5" x="14" y="3" rx="1"/><rect width="7" height="9" x="14" y="12" rx="1"/><rect width="7" height="5" x="3" y="16" rx="1"/>'),
    inbox: svg('<path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>'),
    database: svg('<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14a9 3 0 0 0 18 0V5"/><path d="M3 12a9 3 0 0 0 18 0"/>'),
    send: svg('<path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/>'),
    eye: svg('<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>'),
    eyeOff: svg('<path d="M9.9 4.24A10 10 0 0 1 12 4c6.5 0 10 8 10 8a17 17 0 0 1-2.2 3.2M6.6 6.6A17 17 0 0 0 2 12s3.5 7 10 7a9.7 9.7 0 0 0 5.4-1.6"/><path d="M14.1 14.1a3 3 0 1 1-4.2-4.2"/><path d="m2 2 20 20"/>'),
    star: svg('<path d="m12 2 3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>'),
    clock: svg('<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>'),
    pause: svg('<circle cx="12" cy="12" r="10"/><path d="M10 15V9M14 15V9"/>'),
    calendar: svg('<rect width="18" height="18" x="3" y="4" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>'),
    users: svg('<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>'),
    userPlus: svg('<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M19 8v6M22 11h-6"/>'),
    target: svg('<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>'),
    file: svg('<path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/>'),
    sparkles: svg('<path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3z"/>'),
    search: svg('<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>'),
    briefcase: svg('<rect width="20" height="14" x="2" y="7" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>'),
    check: svg('<path d="M20 6 9 17l-5-5"/>'),
    x: svg('<path d="M18 6 6 18M6 6l12 12"/>'),
    help: svg('<circle cx="12" cy="12" r="10"/><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3M12 17h.01"/>'),
    up: svg('<path d="m18 15-6-6-6 6"/>'),
    down: svg('<path d="m6 9 6 6 6-6"/>'),
    right: svg('<path d="m9 18 6-6-6-6"/>'),
    alert: svg('<circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/>'),
    info: svg('<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>'),
    mail: svg('<rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>'),
    chat: svg('<path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/>'),
    phone: svg('<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"/>'),
    download: svg('<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5M12 15V3"/>'),
    copy: svg('<rect width="14" height="14" x="8" y="8" rx="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>'),
    link: svg('<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>'),
    printer: svg('<path d="M6 9V2h12v7"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect width="12" height="8" x="6" y="14"/>'),
    layers: svg('<path d="m12 2 10 5-10 5L2 7l10-5z"/><path d="m2 17 10 5 10-5M2 12l10 5 10-5"/>'),
    zap: svg('<path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"/>'),
    trend: svg('<path d="m22 7-8.5 8.5-5-5L2 17"/><path d="M16 7h6v6"/>'),
    shield: svg('<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/>'),
    pin: svg('<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>'),
    plus: svg('<path d="M5 12h14M12 5v14"/>'),
    reset: svg('<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>'),
    edit: svg('<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/>'),
    note: svg('<path d="M15.5 3H5a2 2 0 0 0-2 2v14c0 1.1.9 2 2 2h14a2 2 0 0 0 2-2V8.5L15.5 3Z"/><path d="M15 3v6h6"/>'),
    activity: svg('<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>'),
    video: svg('<path d="m22 8-6 4 6 4V8Z"/><rect width="14" height="12" x="2" y="6" rx="2"/>'),
    building: svg('<rect width="16" height="20" x="4" y="2" rx="2"/><path d="M9 22v-4h6v4M8 6h.01M16 6h.01M12 6h.01M12 10h.01M12 14h.01M16 10h.01M16 14h.01M8 10h.01M8 14h.01"/>'),
  };
  const an = (w) => (/^[AEIOU]/i.test(String(w)) ? 'an' : 'a');
  const icon = (name, size = 16, extra = '') => I[name].replace('<svg', `<svg width="${size}" height="${size}" ${extra}`);

  const STAGES = [['new', 'To review', 'clock'], ['shortlisted', 'Shortlisted', 'star'], ['interview', 'Interview', 'calendar'], ['not_now', 'Not now', 'pause']];
  const stageLabel = (d) => (STAGES.find((s) => s[0] === d) || STAGES[0])[1];
  const stageBadge = (a) => ({
    shortlisted: `<span class="badge green">${I.star}Shortlisted</span>`,
    interview: `<span class="badge blue">${I.calendar}Interview</span>`,
    not_now: '<span class="badge">Not now</span>',
  }[a.decision] || '<span class="badge">To review</span>');
  const TIER_COLOURS = { strong: '#16a34a', good: '#2563eb', partial: '#d97706', low: '#cbd5e1' };
  const ring = (score, tierKey, cls = '') => {
    const r = 15.5, c = 2 * Math.PI * r, off = c * (1 - (score || 0) / 100);
    return `<div class="ring ${cls} tier-${tierKey}"><svg viewBox="0 0 36 36"><circle class="bgc" cx="18" cy="18" r="${r}" fill="none" stroke-width="3"/><circle class="fg" cx="18" cy="18" r="${r}" fill="none" stroke-width="3" stroke-linecap="round" stroke-dasharray="${c.toFixed(2)}" stroke-dashoffset="${off.toFixed(2)}"/></svg><b>${score == null ? '–' : score}</b></div>`;
  };
  const matchCell = (a) => (a.score == null
    ? `<span class="state"><span class="dot ${a.status === 'waiting' ? 'violet' : 'grey'}"></span>${a.status === 'waiting' ? 'Awaiting summary' : 'Not scored'}</span>`
    : `<div class="match tier-${a.tier.key}">${ring(a.score, a.tier.key)}<span class="lbl">${a.tier.label}</span></div>`);
  const rtwBadge = (r) => (r ? `<span class="badge rtw-${r.tone}" title="${esc(r.detail)}">${I.shield}${esc(r.label)}</span>` : '');
  const AVAIL_TONE = { Available: 'green', 'Available in 1 month': 'amber', 'Not looking': 'grey', Unknown: 'none' };
  const availBadge = (v) => `<span class="badge avail-${AVAIL_TONE[v] || 'none'}">${esc(v || 'Unknown')}</span>`;
  const count = (list, f) => list.filter(f).length;

  // ================================================================== routing & UI state
  const PAGES = SAMPLE_MODE ? ['dashboard', 'jobs', 'applications', 'pool', 'interviews', 'outbox'] : ['applications'];
  const route = () => {
    if (!SAMPLE_MODE) return { page: 'applications' };
    const [page, id] = location.hash.replace(/^#\/?/, '').split('/');
    if (page === 'jobs' && id && JOB(id)) return { page: 'job', id };
    return { page: PAGES.includes(page) ? page : 'applications' };
  };
  const url = new URL(location.href);
  const qp = (k, d = '') => url.searchParams.get(k) || d;
  const ui = {
    apps: { q: qp('q'), job: qp('job'), role: qp('role'), source: qp('source'), decision: qp('decision'), tier: qp('tier'), sort: qp('sort', SAMPLE_MODE ? 'match' : 'new'), page: 0 },
    selected: new Set(),
    panel: null, // { kind: 'cand' | 'pool', id, list: [ids] }
    jobTab: 'pipeline',
    jobsFilter: 'Open',
    pool: { jobId: '', q: '', page: 0, scanning: false },
    outbox: { tab: 'all', q: '', page: 0 },
  };
  const saveUrl = () => {
    const u = new URL(location.href);
    u.searchParams.delete('done');
    for (const k of ['q', 'job', 'role', 'source', 'decision', 'tier']) ui.apps[k] ? u.searchParams.set(k, ui.apps[k]) : u.searchParams.delete(k);
    ui.apps.sort !== (SAMPLE_MODE ? 'match' : 'new') ? u.searchParams.set('sort', ui.apps.sort) : u.searchParams.delete('sort');
    ui.panel && ui.panel.kind === 'cand' ? u.searchParams.set('id', ui.panel.id) : u.searchParams.delete('id');
    history.replaceState(null, '', u);
  };
  const keepQuery = () => { const u = new URL(location.href); u.searchParams.delete('done'); return u.search; };

  // ================================================================== shell
  document.getElementById('app').innerHTML = `
  <div class="shell">
    <aside class="side" id="side"></aside>
    <main class="main" id="main"><div class="page" id="page"></div></main>
  </div>
  <div class="scrim" id="scrim"></div>
  <aside class="panel" id="panel" aria-hidden="true"></aside>
  <div class="modal-scrim" id="modal"></div>
  <div class="toast hide" id="toast"></div>
  <div class="tip hide" id="tip"></div>`;
  const $ = (id) => document.getElementById(id);
  const toast = (msg, ok = true) => {
    const t = $('toast');
    t.innerHTML = `${icon(ok ? 'check' : 'info', 16, `stroke-width="2.2" style="color:${ok ? 'var(--green)' : 'var(--muted)'}"`)}<span>${esc(msg)}</span>`;
    t.classList.remove('hide'); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.add('hide'), 3800);
  };

  // ================================================================== sidebar
  const upcoming = () => APPS.filter((c) => c.interview && new Date(c.interview.at) > Date.now() - 3600000).sort((a, b) => String(a.interview.at).localeCompare(String(b.interview.at)));
  const renderSide = () => {
    const r = route();
    const nav = (page, label, ic, n) => `<a class="nav-item ${r.page === page || (page === 'jobs' && r.page === 'job') ? 'on' : ''}" href="#/${page}">${I[ic]}<span class="t">${label}</span>${n != null ? `<span class="n">${n}</span>` : ''}</a>`;
    const waiting = count(APPS, (a) => a.status === 'waiting' || a.status === 'error');
    const pipeline = r.page === 'applications' ? `<div class="nav-label">Pipeline</div><nav class="nav">${[['', 'All applications', 'inbox'], ...STAGES].map(([v, l, ic]) =>
      `<button class="nav-item sub ${ui.apps.decision === v ? 'on' : ''}" data-decision="${v}">${I[ic]}<span class="t">${l}</span><span class="n">${count(APPS, (a) => inApps(a, 'decision') && (!v || a.decision === v))}</span></button>`).join('')}</nav>` : '';
    const roles = !SAMPLE_MODE ? (() => {
      const list = S.roles.filter((rr) => count(APPS, (a) => a.role === rr));
      return `<div class="nav-label">Roles</div><nav class="nav roles-nav"><button class="nav-item sub ${ui.apps.role ? '' : 'on'}" data-role="">${I.briefcase}<span class="t">All roles</span><span class="n">${count(APPS, (a) => inApps(a, 'role'))}</span></button>${
        list.map((rr) => `<button class="nav-item sub ${ui.apps.role === rr ? 'on' : ''}" data-role="${esc(rr)}" title="${esc(rr)}">${I.briefcase}<span class="t">${esc(rr)}</span><span class="n">${count(APPS, (a) => a.role === rr && inApps(a, 'role'))}</span></button>`).join('')}</nav>`;
    })() : '';
    const aiCard = SAMPLE_MODE
      ? `<div class="ai-card"><div class="row"><b>${icon('zap', 15, 'stroke-width="1.8"')}Auto-screening</b><span class="switch on" aria-label="Auto-screening on"></span></div>
          <p>New applications are read, scored and acknowledged as they arrive. Average ${Math.round(APPS.reduce((s, a) => s + (a.aiSeconds || 0), 0) / Math.max(1, APPS.length))}s per CV.</p></div>`
      : `<div class="ai-card"><div class="row"><b>${icon('sparkles', 15, 'stroke-width="1.8"')}AI summaries</b>
          <form method="post" action="${S.base}/webhook/applications/settings${keepQuery()}"><input type="hidden" name="run" value="${S.ai.on ? 'ai_off' : 'ai_on'}"><button class="switch ${S.ai.on ? 'on' : ''}" aria-label="AI summaries ${S.ai.on ? 'on, click to turn off' : 'off, click to turn on'}"></button></form></div>
          <p>${S.ai.on ? 'On' : 'Off'} · ${esc(S.ai.model)}<br>${waiting} CVs waiting. Nothing is sent until you click Summarise.</p></div>`;
    $('side').innerHTML = `
      <div class="logo"><div class="logo-mark">F</div>forrof <small>hiring</small></div>
      ${SAMPLE_MODE ? `<div class="workspace"><div class="ws-mark">HR</div><div><b>${esc(DB.agency)}</b><span>Agency workspace</span></div></div>` : ''}
      <nav class="nav">
        ${SAMPLE_MODE ? nav('dashboard', 'Dashboard', 'grid') : ''}
        ${SAMPLE_MODE ? nav('jobs', 'Jobs', 'briefcase', count(DB.jobs, (j) => j.status === 'Open')) : ''}
        ${SAMPLE_MODE ? nav('applications', 'Applications', 'inbox', count(APPS, (a) => a.decision === 'new')) : `<a class="nav-item on" href="#">${I.inbox}<span class="t">Applications</span><span class="n">${APPS.length}</span></a>`}
        ${SAMPLE_MODE ? nav('pool', 'Talent pool', 'database', DB.pool.length) : ''}
        ${SAMPLE_MODE ? nav('interviews', 'Interviews', 'calendar', upcoming().length) : ''}
        ${SAMPLE_MODE ? nav('outbox', 'Outbox', 'send', count(DB.outbox, (m) => m.status === 'Draft') || null) : ''}
      </nav>
      ${pipeline}${roles}
      <div class="grow"></div>
      ${aiCard}
      ${SAMPLE_MODE ? `<div class="me">${userAv(ME.id)}<div><b>${esc(ME.name)}</b><span>${esc(ME.title)}</span></div><button class="btn icon sm ghost" data-reset title="Reset sample data">${I.reset}</button></div>` : ''}
      <div class="status"><span class="dot"></span>Inbox connected · read-only</div>`;
  };
  $('side').addEventListener('click', (e) => {
    const b = e.target.closest('.nav-item[data-decision], .nav-item[data-role]');
    if (b) {
      if (b.dataset.decision !== undefined) ui.apps.decision = b.dataset.decision;
      if (b.dataset.role !== undefined) ui.apps.role = b.dataset.role;
      ui.apps.page = 0; ui.selected.clear(); renderAll();
      return;
    }
    if (e.target.closest('[data-reset]')) {
      try { localStorage.removeItem(STORE); } catch { /* ignore */ }
      location.hash = '#/applications';
      location.reload();
    }
  });

  // ================================================================== applications
  const inApps = (a, ignore = '') => (ignore === 'role' || !ui.apps.role || a.role === ui.apps.role)
    && (ignore === 'job' || !ui.apps.job || a.jobId === ui.apps.job)
    && (ignore === 'source' || !ui.apps.source || a.source === ui.apps.source)
    && (ignore === 'decision' || !ui.apps.decision || a.decision === ui.apps.decision)
    && (ignore === 'tier' || !ui.apps.tier || a.tier.key === ui.apps.tier);
  const sortList = (list, sort) => {
    if (sort === 'match') return [...list].sort((a, b) => (b.score ?? -1) - (a.score ?? -1) || String(b.at).localeCompare(String(a.at)));
    if (sort === 'old') return [...list].sort((a, b) => String(a.at).localeCompare(String(b.at)));
    if (sort === 'name') return [...list].sort((a, b) => a.name.localeCompare(b.name));
    return [...list].sort((a, b) => String(b.at).localeCompare(String(a.at)));
  };
  const searchHay = (a) => `${a.name} ${a.email} ${a.subject || ''} ${a.role} ${a.title} ${a.summary} ${a.loc} ${(a.skills || []).join(' ')} ${jobOf(a) ? jobOf(a).title : ''} ${clientOf(a) ? clientOf(a).name : ''}`.toLowerCase();
  const visibleApps = () => {
    let list = APPS.filter((a) => inApps(a));
    if (ui.apps.q) { const words = ui.apps.q.toLowerCase().split(/\s+/); list = list.filter((a) => { const h = searchHay(a); return words.every((w) => h.includes(w)); }); }
    return sortList(list, ui.apps.sort);
  };

  const statsHtml = () => {
    const scoredN = count(APPS, (a) => a.score != null);
    const readable = count(APPS, (a) => a.status !== 'nothing_to_read');
    const waiting = count(APPS, (a) => a.status === 'waiting' || a.status === 'error');
    return `<div class="stats">
      <div class="stat"><div class="k">${I.users}Applications</div><div class="v">${APPS.length}</div><div class="sub-k up">+${count(APPS, (a) => new Date(a.at) > Date.now() - 7 * 86400000)} this week</div></div>
      <div class="stat"><div class="k">${I.target}Strong matches</div><div class="v">${count(APPS, (a) => a.tier.key === 'strong')}</div><div class="sub-k">Match score of 80 or more</div></div>
      <div class="stat"><div class="k">${I.star}Shortlisted</div><div class="v">${count(APPS, (a) => a.decision === 'shortlisted' || a.decision === 'interview')}</div><div class="sub-k">${count(APPS, (a) => a.decision === 'interview')} in interview</div></div>
      <div class="stat"><div class="k">${I.sparkles}AI screened</div><div class="v">${scoredN}<span class="muted" style="font-size:15px;font-weight:500"> / ${readable}</span></div><div class="sub-k">${scoredN && scoredN === readable ? 'Every CV summarised and scored' : `${waiting} waiting`}</div></div>
    </div>`;
  };
  const insightsHtml = (pool, label) => {
    pool = pool.filter((a) => a.score != null);
    if (!pool.length) return '';
    const years = pool.map((a) => parseFloat(a.exp)).filter((x) => !Number.isNaN(x));
    const avgYears = years.length ? (years.reduce((s, x) => s + x, 0) / years.length).toFixed(1) : '–';
    const skillCount = {};
    pool.forEach((a) => (a.skills || []).forEach((s) => { skillCount[s] = (skillCount[s] || 0) + 1; }));
    const top = Object.entries(skillCount).sort((a, b) => b[1] - a[1]).slice(0, 6);
    const gapCount = {};
    pool.forEach((a) => (a.must || []).forEach((c) => { if (c.s === 'missing') gapCount[c.i] = (gapCount[c.i] || 0) + 1; }));
    const gap = Object.entries(gapCount).sort((a, b) => b[1] - a[1])[0];
    const tiers = ['strong', 'good', 'partial', 'low'].map((k) => [k, pool.filter((a) => a.tier.key === k).length]);
    const names = { strong: 'Strong', good: 'Good', partial: 'Partial', low: 'Low' };
    return `<div class="insights">
      <div><h4>${I.layers}${esc(label)}</h4><div class="big">${pool.length} screened</div><div class="small">Average ${avgYears} years of experience</div></div>
      <div><h4>${I.trend}Match spread</h4><div class="dist">${tiers.filter(([, v]) => v).map(([k, v]) => `<span data-tip="<b>${names[k]} match</b><br>${v} candidate${v === 1 ? '' : 's'}" style="width:${(v / pool.length) * 100}%;background:${TIER_COLOURS[k]}"></span>`).join('')}</div>
        <div class="legend">${tiers.map(([k, v]) => `<span><i style="background:${TIER_COLOURS[k]}"></i>${names[k]} ${v}</span>`).join('')}</div></div>
      <div><h4>${I.zap}Top skills</h4><div class="chips">${top.length ? top.map(([s, c]) => `<span class="chip">${esc(s)}<i>${c}</i></span>`).join('') : '<span class="small">Shown once CVs are summarised</span>'}</div></div>
      <div><h4>${I.alert}Most common gap</h4>${gap ? `<div style="font-weight:500;font-size:13.5px">${esc(gap[0])}</div><div class="small">Missing in ${gap[1]} of ${pool.length} CVs</div>` : '<div class="small">No common gaps</div>'}</div>
    </div>`;
  };

  const renderApplications = () => {
    const list = visibleApps();
    const pages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
    ui.apps.page = Math.min(ui.apps.page, pages - 1);
    const rows = list.slice(ui.apps.page * PAGE_SIZE, ui.apps.page * PAGE_SIZE + PAGE_SIZE);
    const waiting = count(APPS, (a) => a.status === 'waiting' || a.status === 'error');
    const batch = Math.min(waiting, S.ai.batch);
    const openJobs = DB.jobs.filter((j) => j.status === 'Open');
    const insightPool = APPS.filter((a) => (!ui.apps.job || a.jobId === ui.apps.job) && (!ui.apps.role || a.role === ui.apps.role));
    const insightLabel = ui.apps.job ? JOB(ui.apps.job).title : ui.apps.role || (SAMPLE_MODE ? 'All jobs' : 'All roles');
    const pageIds = rows.map((a) => a.id);
    const allOnPage = pageIds.length && pageIds.every((id) => ui.selected.has(id));
    const roleList = S.roles.filter((r) => count(APPS, (a) => a.role === r));
    const srcList = SOURCES.filter((s) => count(APPS, (a) => a.source === s));
    $('page').innerHTML = `
      <div class="head">
        <div><h1>Applications</h1><p>${SAMPLE_MODE ? 'Every application from your inbox and job boards, read, scored and matched to its job automatically.' : 'Every job application from the Forrof inbox, with each CV checked against its role.'}</p></div>
        <div class="head-actions">
          <a class="btn icon" href="${S.base}/webhook/applications${SAMPLE_MODE ? '' : '?demo=1'}" title="${SAMPLE_MODE ? 'Back to the real inbox' : 'Open the sample workspace (fictional agency, for demos)'}">${SAMPLE_MODE ? I.eye : I.eyeOff}</a>
          <button class="btn" data-export>${I.download}Export CSV</button>
          ${SAMPLE_MODE ? '' : `<form method="post" action="${S.base}/webhook/applications/ai${keepQuery()}" id="summarise" style="margin:0"><button class="btn primary" ${S.ai.on && batch ? '' : 'disabled'} title="${S.ai.on ? 'Send the next batch of CVs to OpenAI' : 'Turn AI summaries on first (bottom left)'}">${I.sparkles}Summarise next ${batch || ''}</button></form>`}
        </div>
      </div>
      ${statsHtml()}
      ${insightsHtml(insightPool, insightLabel)}
      <div class="toolbar">
        <div class="search">${I.search}<input id="q" type="search" placeholder="Search candidates, skills, jobs, locations…" value="${esc(ui.apps.q)}" autocomplete="off"></div>
        ${SAMPLE_MODE
          ? `<select class="select" data-f="job"><option value="">All jobs</option>${openJobs.map((j) => `<option value="${j.id}" ${ui.apps.job === j.id ? 'selected' : ''}>${esc(j.title)} · ${esc(CLIENT(j.clientId).name)}</option>`).join('')}</select>
             <select class="select" data-f="source"><option value="">All sources</option>${srcList.map((s) => `<option ${ui.apps.source === s ? 'selected' : ''}>${esc(s)}</option>`).join('')}</select>`
          : `<select class="select" data-f="role"><option value="">All roles</option>${roleList.map((r) => `<option value="${esc(r)}" ${ui.apps.role === r ? 'selected' : ''}>${esc(r)}</option>`).join('')}</select>`}
        <select class="select" data-f="tier">${[['', 'All matches'], ['strong', 'Strong (80+)'], ['good', 'Good (60–79)'], ['partial', 'Partial (40–59)'], ['low', 'Low (under 40)']].map(([v, l]) => `<option value="${v}" ${ui.apps.tier === v ? 'selected' : ''}>${l}</option>`).join('')}</select>
        <select class="select" data-f="sort">${[['match', 'Best match'], ['new', 'Newest first'], ['old', 'Oldest first'], ['name', 'Name A–Z']].map(([v, l]) => `<option value="${v}" ${ui.apps.sort === v ? 'selected' : ''}>${l}</option>`).join('')}</select>
        <span class="count">${list.length.toLocaleString('en-GB')} ${list.length === 1 ? 'candidate' : 'candidates'}</span>
      </div>
      ${ui.selected.size ? `<div class="bulkbar"><b>${ui.selected.size} selected</b>
        <button class="btn sm" data-bulk="shortlisted">${I.star}Shortlist</button>
        <button class="btn sm" data-bulk="not_now">${I.pause}Not now</button>
        ${SAMPLE_MODE ? `<button class="btn sm" data-bulk="message">${I.chat}Message</button>
        <select class="select sm" data-bulk-assign><option value="">Assign to…</option>${DB.team.map((u) => `<option value="${u.id}">${esc(u.name)}</option>`).join('')}</select>` : ''}
        <button class="btn sm" data-bulk="export">${I.download}Export</button>
        <button class="btn sm ghost" data-bulk="clear">Clear</button></div>` : ''}
      <div class="table-wrap"><table class="apps ${SAMPLE_MODE ? 'full' : ''}">
        <thead><tr><th class="col-cb"><input type="checkbox" class="cb" data-sel-all ${allOnPage ? 'checked' : ''} aria-label="Select all on this page"></th><th>Candidate</th>
          ${SAMPLE_MODE ? '<th class="col-job">Job</th>' : '<th class="col-role">Role</th>'}<th class="col-match">Match</th>
          ${SAMPLE_MODE ? '<th class="col-rtw">Right to work</th><th class="col-src">Source</th>' : '<th class="col-exp">Experience</th>'}
          <th class="col-when">Received</th><th class="col-status">Stage</th></tr></thead>
        <tbody>${rows.length ? rows.map((a) => {
          const j = jobOf(a), cl = clientOf(a);
          return `<tr data-open="cand:${a.id}" class="${ui.panel && ui.panel.id === a.id ? 'sel' : ''} ${ui.selected.has(a.id) ? 'checked' : ''}">
            <td class="col-cb"><input type="checkbox" class="cb" data-sel="${a.id}" ${ui.selected.has(a.id) ? 'checked' : ''} aria-label="Select ${esc(a.name)}"></td>
            <td><div class="cand">${avatar(a)}<div style="min-width:0"><div class="nm">${esc(a.name)}${a.dup ? `<span class="flag badge amber" title="${esc(a.dup)}">Duplicate</span>` : ''}</div>
              <div class="em">${esc([!notStated(a.title) ? a.title : '', !notStated(a.loc) ? a.loc : ''].filter(Boolean).join(' · ') || a.email || a.subject)}</div></div></div></td>
            ${SAMPLE_MODE ? `<td class="col-job"><div class="two"><b>${esc(j ? j.title : a.role)}</b><span>${esc(cl ? cl.name : '')}</span></div></td>` : `<td class="col-role"><div class="role-cell" title="${esc(a.role)}">${esc(a.role)}</div></td>`}
            <td class="col-match">${matchCell(a)}</td>
            ${SAMPLE_MODE ? `<td class="col-rtw">${rtwBadge(a.rtw)}</td><td class="col-src muted">${esc(a.source)}</td>` : `<td class="col-exp muted nowrap">${esc(!notStated(a.exp) && a.exp ? a.exp : '–')}</td>`}
            <td class="col-when muted nowrap" title="${esc(when(a.at))}">${ago(a.at)}</td>
            <td class="col-status"><div class="stage-cell">${stageBadge(a)}${SAMPLE_MODE ? userAv(a.owner, 'xs') : ''}</div></td>
          </tr>`;
        }).join('') : `<tr><td colspan="8"><div class="empty"><b>No candidates found</b>Try a different search or filter.</div></td></tr>`}</tbody>
      </table></div>
      ${list.length > PAGE_SIZE ? `<div class="pager"><span>Showing ${ui.apps.page * PAGE_SIZE + 1}–${Math.min(list.length, (ui.apps.page + 1) * PAGE_SIZE)} of ${list.length.toLocaleString('en-GB')}</span>
        <div class="btns"><button class="btn sm" data-page="-1" ${ui.apps.page ? '' : 'disabled'}>Previous</button><button class="btn sm" data-page="1" ${ui.apps.page < pages - 1 ? '' : 'disabled'}>Next</button></div></div>` : ''}`;
    ui.panelListFallback = list.map((a) => a.id);
    const form = $('summarise');
    if (form) form.addEventListener('submit', () => { const b = form.querySelector('button'); b.disabled = true; b.innerHTML = `${I.sparkles}Summarising…`; });
  };

  // ================================================================== jobs
  const jobStats = (job) => {
    const list = APPS.filter((a) => a.jobId === job.id);
    return {
      list, applicants: list.length,
      strong: count(list, (a) => a.tier.key === 'strong'),
      shortlisted: count(list, (a) => a.decision === 'shortlisted' || a.decision === 'interview'),
      interviews: count(list, (a) => a.decision === 'interview'),
      avg: list.length ? Math.round(list.reduce((s, a) => s + (a.score || 0), 0) / list.length) : 0,
    };
  };
  const spreadBar = (list) => {
    const tiers = ['strong', 'good', 'partial', 'low'].map((k) => [k, count(list, (a) => a.tier.key === k)]).filter(([, v]) => v);
    return list.length ? `<div class="dist mini">${tiers.map(([k, v]) => `<span style="width:${(v / list.length) * 100}%;background:${TIER_COLOURS[k]}"></span>`).join('')}</div>` : '';
  };
  const renderJobs = () => {
    const list = DB.jobs.filter((j) => ui.jobsFilter === 'All' || j.status === ui.jobsFilter);
    $('page').innerHTML = `
      <div class="head">
        <div><h1>Jobs</h1><p>${count(DB.jobs, (j) => j.status === 'Open')} open jobs across ${new Set(DB.jobs.filter((j) => j.status === 'Open').map((j) => j.clientId)).size} clients. Every application is screened against its job's checklist.</p></div>
        <div class="head-actions"><button class="btn primary" data-new-job>${I.plus}New job</button></div>
      </div>
      <div class="seg-inline">${['Open', 'Filled', 'All'].map((f) => `<button class="${ui.jobsFilter === f ? 'on' : ''}" data-jobs-filter="${f}">${f}<i>${f === 'All' ? DB.jobs.length : count(DB.jobs, (j) => j.status === f)}</i></button>`).join('')}</div>
      <div class="job-grid">${list.map((j) => {
        const c = CLIENT(j.clientId); const st = jobStats(j);
        const closing = j.status === 'Open' && new Date(j.closesAt) - Date.now() < 4 * 86400000;
        return `<a class="job-card" href="#/jobs/${j.id}">
          <div class="jc-top">${clientMark(c)}<div style="min-width:0"><div class="jc-title">${esc(j.title)}</div><div class="jc-client">${esc(c.name)} · ${esc(c.sector)}</div></div>
            <span class="state">${j.status === 'Filled' ? '<span class="dot grey"></span>Filled' : `<span class="dot ${closing ? 'amber' : ''}"></span>${esc(until(j.closesAt).replace('closes', 'Closes'))}`}</span></div>
          <div class="jc-meta"><span>${icon('pin', 14)}${esc(j.location)}</span><span>${icon('briefcase', 14)}${esc(j.type)}</span><span>${esc(j.pay)}</span></div>
          <div class="jc-stats"><div><b>${st.applicants}</b><span>Applicants</span></div><div><b>${st.strong}</b><span>Strong matches</span></div><div><b>${st.shortlisted}</b><span>Shortlisted</span></div><div><b>${st.interviews}</b><span>Interviews</span></div></div>
          ${j.status === 'Filled' ? `<div class="jc-note">${esc(j.filledNote || 'Filled')}</div>` : spreadBar(st.list)}
          <div class="jc-foot">${userAv(j.owner, 'xs')}<span>${esc((USER(j.owner) || {}).name || '')}</span><span class="muted">· opened ${ago(j.openedAt).toLowerCase()}</span><span class="go">Open ${icon('right', 14)}</span></div>
        </a>`;
      }).join('') || '<div class="empty"><b>No jobs here</b></div>'}</div>`;
  };

  const kanbanCard = (a) => `<div class="kcard" draggable="true" data-open="cand:${a.id}" data-drag="${a.id}">
      <div class="kc-top">${avatar(a)}<div style="min-width:0"><div class="nm">${esc(a.name)}</div><div class="em">${esc(a.title)} · ${esc(a.exp)}</div></div>${ring(a.score, a.tier.key)}</div>
      <div class="kc-tags">${rtwBadge(a.rtw)}<span class="badge">${esc(a.source)}</span>${a.interview ? `<span class="badge blue">${I.calendar}${esc(fmt(a.interview.at, { weekday: 'short', hour: '2-digit', minute: '2-digit' }))}</span>` : ''}</div>
      <div class="kc-foot"><span class="muted">${ago(a.at)}</span>${userAv(a.owner, 'xs')}</div>
    </div>`;
  const renderJob = (id) => {
    const j = JOB(id), c = CLIENT(j.clientId), st = jobStats(j);
    const matches = j.poolMatchIds ? j.poolMatchIds.map((pid) => DB.pool.find((p) => p.id === pid)).filter(Boolean) : null;
    const tabs = [['pipeline', `Pipeline<i>${st.applicants}</i>`], ['requirements', 'Requirements'], ['pool', `Talent pool matches${matches ? `<i>${matches.length}</i>` : ''}`]];
    let body = '';
    if (ui.jobTab === 'pipeline') {
      body = st.applicants ? `<div class="kanban">${STAGES.map(([v, l, ic]) => {
        const items = sortList(st.list.filter((a) => a.decision === v), 'match');
        return `<div class="kcol" data-drop="${v}"><div class="kcol-h">${I[ic]}<b>${l}</b><span>${items.length}</span></div><div class="kcol-b">${items.map(kanbanCard).join('') || '<div class="kempty">Drop candidates here</div>'}</div></div>`;
      }).join('')}</div>` : `<div class="empty card-empty"><b>No applicants yet</b>New applications for this job will appear here, already scored.<br><br><button class="btn primary" data-scan="${j.id}">${I.database}Find matches in the talent pool</button></div>`;
    } else if (ui.jobTab === 'requirements') {
      body = `<div class="req-grid">
        <div class="block"><div class="block-h"><h3>Screening checklist</h3><span>Every CV is checked against this automatically</span></div>
          <div class="req-list"><h5>Must-haves · 80% of the score</h5><ol>${j.must.map((m) => `<li>${esc(m)}</li>`).join('')}</ol><h5>Nice-to-haves · 20% of the score</h5><ol>${j.nice.map((m) => `<li>${esc(m)}</li>`).join('')}</ol></div></div>
        <div>
          <div class="block"><div class="block-h"><h3>Compliance documents</h3><span>Requested when a candidate is shortlisted</span></div>
            <ul class="doc-list">${j.compliance.map((d) => `<li>${icon('file', 15)}${esc(d)}</li>`).join('')}</ul></div>
          <div class="block"><div class="block-h"><h3>Job details</h3></div>
            <dl class="meta"><dt>Client</dt><dd>${esc(c.name)} · ${esc(c.sector)}</dd><dt>Hiring manager</dt><dd>${esc(c.contact)}, ${esc(c.contactTitle)}</dd>
              <dt>Location</dt><dd>${esc(j.location)}</dd><dt>Type</dt><dd>${esc(j.type)}</dd><dt>Pay</dt><dd>${esc(j.pay)}</dd>
              <dt>Consultant</dt><dd>${esc((USER(j.owner) || {}).name || '')}</dd><dt>Opened</dt><dd>${day(j.openedAt)}</dd><dt>Closing date</dt><dd>${day(j.closesAt)}</dd></dl></div>
        </div></div>`;
    } else {
      body = matches ? `<div class="scan-result">${icon('sparkles', 18)}<div><b>${matches.length} people you already know match this job</b><span>${count(matches, (p) => p.tier.key === 'strong')} strong and ${count(matches, (p) => p.tier.key === 'good')} good matches from ${count(DB.pool, (p) => p.family === j.family)} ${esc(j.family)} profiles in your talent pool, re-scored ${ago(j.poolScannedAt).toLowerCase()}. Select people to check their availability by WhatsApp.</span></div></div>${poolTable(matches, j, { compact: true })}` : `<div class="empty card-empty"><b>Re-match your talent pool</b>Score every past candidate against this job's checklist in seconds.<br><br><button class="btn primary" data-scan="${j.id}">${I.database}Find matches in the talent pool</button></div>`;
    }
    $('page').innerHTML = `
      <div class="crumbs"><a href="#/jobs">Jobs</a>${icon('right', 14)}<span>${esc(j.title)}</span></div>
      <div class="head job-head">
        <div class="jh">${clientMark(c, 'lg')}<div><h1>${esc(j.title)}</h1><p class="jh-meta"><span>${icon('building', 14)}${esc(c.name)}</span><span>${icon('pin', 14)}${esc(j.location)}</span><span>${icon('briefcase', 14)}${esc(j.type)}</span><span>${esc(j.pay)}</span>
          <span class="state">${j.status === 'Filled' ? '<span class="dot grey"></span>Filled' : `<span class="dot"></span>Open · ${esc(until(j.closesAt))}`}</span></p></div></div>
        <div class="head-actions">
          <button class="btn" data-scan="${j.id}">${I.database}Re-match talent pool</button>
          <button class="btn primary" data-shortlist="${j.id}">${I.file}Client shortlist</button>
        </div>
      </div>
      <div class="job-kpis">
        <div><span>Applicants</span><b>${st.applicants}</b></div><div><span>Strong matches</span><b>${st.strong}</b></div><div><span>Average match</span><b>${st.applicants ? st.avg : '–'}</b></div>
        <div><span>Shortlisted</span><b>${st.shortlisted}</b></div><div><span>Interviews</span><b>${st.interviews}</b></div><div class="grow2">${spreadBar(st.list)}</div>
      </div>
      <div class="tabs-line">${tabs.map(([k, l]) => `<button class="${ui.jobTab === k ? 'on' : ''}" data-job-tab="${k}">${l}</button>`).join('')}</div>
      ${body}`;
    ui.panelListFallback = sortList(st.list, 'match').map((a) => a.id);
  };

  // ================================================================== talent pool
  const poolTable = (people, job, { compact = false } = {}) => {
    const pageIds = people.map((p) => p.id);
    const all = pageIds.length && pageIds.every((id) => ui.selected.has(id));
    return `${ui.selected.size ? `<div class="bulkbar"><b>${ui.selected.size} selected</b>
        <button class="btn sm" data-pool-bulk="message">${I.chat}Check availability by WhatsApp</button>
        ${job ? `<button class="btn sm" data-pool-bulk="add">${I.userPlus}Add to ${esc(job.title)}</button>` : ''}
        <button class="btn sm ghost" data-pool-bulk="clear">Clear</button></div>` : ''}
      <div class="table-wrap"><table class="pool">
        <thead><tr><th class="col-cb"><input type="checkbox" class="cb" data-sel-all-pool ${all ? 'checked' : ''} aria-label="Select all"></th><th>Candidate</th><th class="col-hist">Last activity</th>${job ? '<th class="col-match">Match</th>' : '<th class="col-fam">Profile</th>'}<th class="col-rtw">Right to work</th><th class="col-avail">Availability</th><th class="col-act"></th></tr></thead>
        <tbody>${people.map((p) => `<tr data-open="pool:${p.id}" class="${ui.selected.has(p.id) ? 'checked' : ''}">
          <td class="col-cb"><input type="checkbox" class="cb" data-sel="${p.id}" ${ui.selected.has(p.id) ? 'checked' : ''} aria-label="Select ${esc(p.name)}"></td>
          <td><div class="cand">${avatar(p)}<div style="min-width:0"><div class="nm">${esc(p.name)}</div><div class="em">${esc(p.title)} · ${esc(p.exp)} · ${esc(p.loc)}</div></div></div></td>
          <td class="col-hist"><div class="two"><b>${esc(p.history)}</b><span>${ago(p.lastContact)}</span></div></td>
          ${job ? `<td class="col-match">${matchCell(p)}</td>` : `<td class="col-fam muted">${esc(p.family)}</td>`}
          <td class="col-rtw">${rtwBadge(p.rtw)}</td>
          <td class="col-avail">${availBadge(p.availability)}</td>
          <td class="col-act">${job ? (p.addedTo.includes(job.id) ? `<span class="badge green">${I.check}Added</span>` : `<button class="btn sm" data-add-pool="${p.id}" data-job="${job.id}">${I.userPlus}Add</button>`) : `<button class="btn sm" data-msg-pool="${p.id}">${I.chat}Message</button>`}</td>
        </tr>`).join('') || `<tr><td colspan="7"><div class="empty"><b>No matches</b></div></td></tr>`}</tbody></table></div>
      ${compact ? '' : ''}`;
  };
  const renderPool = () => {
    const job = ui.pool.jobId ? JOB(ui.pool.jobId) : null;
    let people;
    let summary = '';
    if (job && job.poolMatchIds) {
      people = job.poolMatchIds.map((id) => DB.pool.find((p) => p.id === id)).filter(Boolean);
      const fam = count(DB.pool, (p) => p.family === job.family);
      summary = `<div class="scan-result">${icon('sparkles', 18)}<div><b>${people.length} people you already know match ${esc(job.title)}</b><span>${count(people, (p) => p.tier.key === 'strong')} strong and ${count(people, (p) => p.tier.key === 'good')} good matches out of ${fam} ${esc(job.family)} profiles, re-scored against this job's checklist ${ago(job.poolScannedAt).toLowerCase()}.</span></div></div>`;
    } else {
      people = [...DB.pool].sort((a, b) => String(b.lastContact).localeCompare(String(a.lastContact)));
      if (ui.pool.q) { const w = ui.pool.q.toLowerCase().split(/\s+/); people = people.filter((p) => { const h = `${p.name} ${p.title} ${p.loc} ${p.family} ${p.skills.join(' ')} ${p.history}`.toLowerCase(); return w.every((x) => h.includes(x)); }); }
    }
    const pages = Math.max(1, Math.ceil(people.length / PAGE_SIZE));
    ui.pool.page = Math.min(ui.pool.page, pages - 1);
    const rows = people.slice(ui.pool.page * PAGE_SIZE, ui.pool.page * PAGE_SIZE + PAGE_SIZE);
    $('page').innerHTML = `
      <div class="head"><div><h1>Talent pool</h1><p>${DB.pool.length} past candidates. Re-score all of them against any open job in seconds, then check who's available by WhatsApp.</p></div></div>
      <div class="rematch">
        <div class="rm-l">${icon('database', 20)}<div><b>Re-match your database</b><span>Pick a job and every past CV is scored against its checklist.</span></div></div>
        <select class="select" data-pool-job><option value="">Choose a job…</option>${DB.jobs.filter((j) => j.status === 'Open').map((j) => `<option value="${j.id}" ${ui.pool.jobId === j.id ? 'selected' : ''}>${esc(j.title)} · ${esc(CLIENT(j.clientId).name)}</option>`).join('')}</select>
        <button class="btn primary" data-scan="${ui.pool.jobId}" ${ui.pool.jobId ? '' : 'disabled'}>${I.sparkles}Find matches</button>
      </div>
      ${summary}
      ${job && job.poolMatchIds ? '' : `<div class="toolbar"><div class="search">${I.search}<input id="pool-q" type="search" placeholder="Search past candidates, skills, locations…" value="${esc(ui.pool.q)}" autocomplete="off"></div><span class="count">${people.length} people</span></div>`}
      ${poolTable(rows, job && job.poolMatchIds ? job : null)}
      ${people.length > PAGE_SIZE ? `<div class="pager"><span>Showing ${ui.pool.page * PAGE_SIZE + 1}–${Math.min(people.length, (ui.pool.page + 1) * PAGE_SIZE)} of ${people.length}</span>
        <div class="btns"><button class="btn sm" data-pool-page="-1" ${ui.pool.page ? '' : 'disabled'}>Previous</button><button class="btn sm" data-pool-page="1" ${ui.pool.page < pages - 1 ? '' : 'disabled'}>Next</button></div></div>` : ''}`;
    ui.panelListFallback = rows.map((p) => p.id);
  };

  // ================================================================== interviews
  const renderInterviews = () => {
    const list = upcoming();
    const groups = {};
    list.forEach((c) => { const k = fmt(c.interview.at, { year: 'numeric', month: '2-digit', day: '2-digit' }); (groups[k] = groups[k] || []).push(c); });
    const week = count(list, (c) => new Date(c.interview.at) < Date.now() + 7 * 86400000);
    $('page').innerHTML = `
      <div class="head"><div><h1>Interviews</h1><p>${week} interviews in the next 7 days. Candidates get the invite by email and a WhatsApp reminder the day before.</p></div></div>
      <div class="stats three">
        <div class="stat"><div class="k">${I.calendar}Upcoming</div><div class="v">${list.length}</div></div>
        <div class="stat"><div class="k">${I.check}Confirmed</div><div class="v">${count(list, (c) => c.interview.status === 'Confirmed')}</div></div>
        <div class="stat"><div class="k">${I.clock}Awaiting reply</div><div class="v">${count(list, (c) => c.interview.status !== 'Confirmed')}</div></div>
      </div>
      ${Object.values(groups).map((items) => `<div class="agenda-day"><h3>${esc(longDay(items[0].interview.at))}<span>${items.length} interview${items.length === 1 ? '' : 's'}</span></h3>
        <div class="table-wrap">${items.map((c) => { const j = jobOf(c), cl = clientOf(c); return `<div class="agenda-row" data-open="cand:${c.id}">
          <div class="ag-time"><b>${time(c.interview.at)}</b><span>${c.interview.duration} min</span></div>
          <div class="cand">${avatar(c)}<div style="min-width:0"><div class="nm">${esc(c.name)}</div><div class="em">${esc(j.title)} · ${esc(cl.name)}</div></div></div>
          <div class="ag-format">${icon(/Video/.test(c.interview.format) ? 'video' : /Phone/.test(c.interview.format) ? 'phone' : 'building', 15)}${esc(c.interview.format)}</div>
          <div class="ag-with">${esc(c.interview.with.join(', '))}</div>
          <div>${c.interview.status === 'Confirmed' ? `<span class="badge green">${I.check}Confirmed</span>` : `<span class="badge amber">${I.clock}Awaiting reply</span>`}</div>
          <div class="ag-score">${ring(c.score, c.tier.key)}</div>
        </div>`; }).join('')}</div></div>`).join('') || '<div class="empty card-empty"><b>No interviews booked</b>Move a candidate to Interview to book one.</div>'}`;
    ui.panelListFallback = list.map((c) => c.id);
  };

  // ================================================================== outbox
  const KIND = { ack: ['Acknowledgement', ''], decline: ['Decline', ''], invite: ['Interview invite', 'blue'], docs: ['Documents request', 'amber'], message: ['Message', 'brand'], shortlist: ['Client shortlist', 'green'], reminder: ['Reminder', ''] };
  const renderOutbox = () => {
    const tabs = [['all', 'All', DB.outbox.length], ['Draft', 'Drafts', count(DB.outbox, (m) => m.status === 'Draft')], ['sent', 'Sent', count(DB.outbox, (m) => m.status !== 'Draft')], ['chat', 'WhatsApp & SMS', count(DB.outbox, (m) => m.channel !== 'Email')]];
    let list = DB.outbox.filter((m) => ui.outbox.tab === 'all' || (ui.outbox.tab === 'Draft' && m.status === 'Draft') || (ui.outbox.tab === 'sent' && m.status !== 'Draft') || (ui.outbox.tab === 'chat' && m.channel !== 'Email'));
    if (ui.outbox.q) { const w = ui.outbox.q.toLowerCase(); list = list.filter((m) => `${m.toName} ${m.subject} ${m.body}`.toLowerCase().includes(w)); }
    list = [...list].sort((a, b) => String(b.at).localeCompare(String(a.at)));
    const pages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
    ui.outbox.page = Math.min(ui.outbox.page, pages - 1);
    const rows = list.slice(ui.outbox.page * PAGE_SIZE, ui.outbox.page * PAGE_SIZE + PAGE_SIZE);
    const drafts = count(DB.outbox, (m) => m.status === 'Draft');
    const A = DB.automations;
    $('page').innerHTML = `
      <div class="head"><div><h1>Outbox</h1><p>Every email and message sent to candidates and clients, in one place. Automatic messages go out on their own; declines wait for your approval.</p></div>
        <div class="head-actions">${drafts ? `<button class="btn primary" data-approve-all>${I.send}Approve ${drafts} draft${drafts === 1 ? '' : 's'}</button>` : ''}</div></div>
      <div class="automations">
        <div class="auto"><div>${icon('mail', 18)}</div><div><b>Acknowledge new applications</b><span>Every applicant gets a "we've received it" email within a minute.</span></div><button class="switch ${A.acknowledge ? 'on' : ''}" data-auto="acknowledge" aria-label="Acknowledge new applications"></button></div>
        <div class="auto"><div>${icon('pause', 18)}</div><div><b>Decline emails</b><span>${A.declines === 'draft' ? 'Drafted when you mark someone "Not now", sent after you approve.' : 'Not drafted.'}</span></div><button class="switch ${A.declines === 'draft' ? 'on' : ''}" data-auto="declines" aria-label="Decline emails"></button></div>
        <div class="auto"><div>${icon('chat', 18)}</div><div><b>Interview reminders</b><span>A WhatsApp reminder to the candidate the day before.</span></div><button class="switch ${A.reminders ? 'on' : ''}" data-auto="reminders" aria-label="Interview reminders"></button></div>
      </div>
      <div class="tabs-line">${tabs.map(([k, l, n]) => `<button class="${ui.outbox.tab === k ? 'on' : ''}" data-ob-tab="${k}">${l}<i>${n}</i></button>`).join('')}</div>
      <div class="toolbar"><div class="search">${I.search}<input id="ob-q" type="search" placeholder="Search messages…" value="${esc(ui.outbox.q)}" autocomplete="off"></div><span class="count">${list.length} messages</span></div>
      <div class="table-wrap"><table class="outbox">
        <thead><tr><th class="col-chan"></th><th class="col-to">To</th><th>Message</th><th class="col-kind">Type</th><th class="col-ostatus">Status</th><th class="col-when">Time</th></tr></thead>
        <tbody>${rows.map((m) => `<tr data-ob="${m.id}">
          <td class="col-chan"><span class="chan chan-${m.channel.toLowerCase()}">${icon(m.channel === 'Email' ? 'mail' : m.channel === 'SMS' ? 'phone' : 'chat', 15)}</span></td>
          <td class="col-to"><div class="two"><b>${esc(m.toName)}</b><span>${esc(m.channel === 'Email' ? m.to : `${m.channel} · ${m.to}`)}</span></div></td>
          <td><div class="two"><b>${esc(m.channel === 'Email' ? m.subject : m.body.slice(0, 80))}</b><span>${esc((m.channel === 'Email' ? m.body.replace(/^Hi [^,]+,\s*/, '') : '').slice(0, 110))}</span></div></td>
          <td class="col-kind"><span class="badge ${KIND[m.kind] ? KIND[m.kind][1] : ''}">${esc(KIND[m.kind] ? KIND[m.kind][0] : m.kind)}</span></td>
          <td class="col-ostatus">${m.status === 'Draft' ? '<span class="state"><span class="dot amber"></span>Draft</span>' : `<span class="state"><span class="dot"></span>${esc(m.status)}</span>`}</td>
          <td class="col-when muted nowrap" title="${esc(when(m.at))}">${ago(m.at)}</td>
        </tr>`).join('') || '<tr><td colspan="6"><div class="empty"><b>Nothing here</b></div></td></tr>'}</tbody></table></div>
      ${list.length > PAGE_SIZE ? `<div class="pager"><span>Showing ${ui.outbox.page * PAGE_SIZE + 1}–${Math.min(list.length, (ui.outbox.page + 1) * PAGE_SIZE)} of ${list.length}</span>
        <div class="btns"><button class="btn sm" data-ob-page="-1" ${ui.outbox.page ? '' : 'disabled'}>Previous</button><button class="btn sm" data-ob-page="1" ${ui.outbox.page < pages - 1 ? '' : 'disabled'}>Next</button></div></div>` : ''}`;
  };

  // ================================================================== dashboard
  const RAMP = ['#86b6ef', '#5598e7', '#2a78d6', '#1c5cab', '#104281'];
  const columnChart = (points, height = 190) => {
    const W = 680, padL = 30, padR = 6, padT = 10, padB = 24;
    const innerW = W - padL - padR, innerH = height - padT - padB;
    const maxV = Math.max(1, ...points.map((p) => p.v));
    const step = maxV <= 4 ? 1 : maxV <= 10 ? 2 : maxV <= 20 ? 5 : 10;
    const top = Math.ceil(maxV / step) * step;
    const band = innerW / points.length, bw = Math.min(16, band - 2);
    const y = (v) => padT + innerH - (v / top) * innerH;
    let out = '';
    for (let t = 0; t <= top; t += step) out += `<line x1="${padL}" x2="${W - padR}" y1="${y(t)}" y2="${y(t)}" class="grid"/><text x="${padL - 8}" y="${y(t) + 3.5}" class="axis" text-anchor="end">${t}</text>`;
    points.forEach((p, i) => {
      const x = padL + i * band + (band - bw) / 2;
      const h = (p.v / top) * innerH;
      if (h > 0) {
        const r = Math.min(4, h, bw / 2), yy = padT + innerH - h;
        out += `<path d="M${x},${yy + r} q0,${-r} ${r},${-r} h${bw - 2 * r} q${r},0 ${r},${r} v${h - r} h${-bw} z" fill="${p.today ? '#1c5cab' : '#2a78d6'}"/>`;
      }
      out += `<rect x="${padL + i * band}" y="${padT}" width="${band}" height="${innerH}" fill="transparent" data-tip="${esc(p.tip)}" class="hit"/>`;
      if (p.label) out += `<text x="${x + bw / 2}" y="${height - 6}" class="axis" text-anchor="middle">${esc(p.label)}</text>`;
    });
    return `<svg viewBox="0 0 ${W} ${height}" class="chart" role="img" aria-label="Applications per day">${out}</svg>`;
  };
  const sparkline = (vals) => {
    const W = 84, H = 26, max = Math.max(1, ...vals);
    const pts = vals.map((v, i) => `${(i / (vals.length - 1)) * (W - 4) + 2},${H - 3 - (v / max) * (H - 6)}`);
    const last = pts[pts.length - 1].split(',');
    return `<svg viewBox="0 0 ${W} ${H}" class="spark"><polyline points="${pts.join(' ')}" fill="none" stroke="#94a3b8" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/><circle cx="${last[0]}" cy="${last[1]}" r="3" fill="#2a78d6" stroke="#fff" stroke-width="2"/></svg>`;
  };
  const renderDashboard = () => {
    const now = Date.now(), D = 86400000;
    const dayKey = (d) => fmt(d, { year: 'numeric', month: '2-digit', day: '2-digit' });
    const perDay = {};
    APPS.forEach((a) => { const k = dayKey(a.at); perDay[k] = (perDay[k] || 0) + 1; });
    const days = Array.from({ length: 30 }, (_, i) => new Date(now - (29 - i) * D));
    const points = days.map((d, i) => {
      const v = perDay[dayKey(d)] || 0;
      return { v, today: i === 29, label: i % 7 === 1 || i === 29 ? (i === 29 ? 'Today' : fmt(d, { day: 'numeric', month: 'short' })) : '', tip: `<b>${fmt(d, { weekday: 'short', day: 'numeric', month: 'short' })}</b><br>${v} application${v === 1 ? '' : 's'}` };
    });
    const last14 = points.slice(-14).map((p) => p.v);
    const shortlistTimes = APPS.map((a) => { const ev = (a.events || []).find((e) => e.text === 'Moved to Shortlisted'); return ev ? (new Date(ev.at) - new Date(a.at)) / 3600000 : null; }).filter((x) => x != null && x > 0);
    const avgShort = shortlistTimes.length ? shortlistTimes.reduce((s, x) => s + x, 0) / shortlistTimes.length : 0;
    const funnel = [
      ['Applied', APPS.length], ['Screened by AI', count(APPS, (a) => a.score != null)], ['Good or strong match', count(APPS, (a) => ['good', 'strong'].includes(a.tier.key))],
      ['Shortlisted', count(APPS, (a) => ['shortlisted', 'interview'].includes(a.decision))], ['Interview', count(APPS, (a) => a.decision === 'interview')],
    ];
    const src = SOURCES.map((s) => { const l = APPS.filter((a) => a.source === s); return { s, n: l.length, strong: count(l, (a) => a.tier.key === 'strong'), short: count(l, (a) => ['shortlisted', 'interview'].includes(a.decision)) }; }).filter((x) => x.n).sort((a, b) => b.n - a.n);
    const maxSrc = Math.max(...src.map((x) => x.n));
    const rated = src.filter((x) => x.n >= 5).map((x) => ({ ...x, rate: x.strong / x.n })).sort((a, b) => b.rate - a.rate);
    const insight = rated.length >= 2 ? `${rated[0].s} brings the highest share of strong matches (${Math.round(rated[0].rate * 100)}%); ${rated[rated.length - 1].s} brings volume but fewer strong matches (${Math.round(rated[rated.length - 1].rate * 100)}%).` : '';
    const feed = APPS.flatMap((a) => (a.events || []).filter((e) => e.by !== 'system').map((e) => ({ ...e, cand: a }))).sort((a, b) => String(b.at).localeCompare(String(a.at))).slice(0, 7);
    const hour = Number(fmt(now, { hour: '2-digit', hour12: false }));
    $('page').innerHTML = `
      <div class="head"><div><h1>Good ${hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening'}, ${esc(firstOf(ME.name))}</h1><p>${esc(longDay(now))} · Here's what's happening across your desks.</p></div>
        <div class="head-actions"><a class="btn" href="#/applications">${I.inbox}Review applications</a></div></div>
      <div class="stats">
        <div class="stat"><div class="k">${I.users}Applications (30 days)</div><div class="v-row"><div class="v">${APPS.length}</div>${sparkline(last14)}</div><div class="sub-k up">+${count(APPS, (a) => new Date(a.at) > now - 7 * D)} this week</div></div>
        <div class="stat"><div class="k">${I.zap}First response</div><div class="v">45 sec</div><div class="sub-k">Every applicant acknowledged automatically</div></div>
        <div class="stat"><div class="k">${I.star}Time to shortlist</div><div class="v">${avgShort ? `${avgShort.toFixed(1)} h` : '–'}</div><div class="sub-k">From application to shortlist</div></div>
        <div class="stat"><div class="k">${I.calendar}Interviews this week</div><div class="v">${count(upcoming(), (c) => new Date(c.interview.at) < now + 7 * D)}</div><div class="sub-k">${count(upcoming(), (c) => c.interview.status === 'Confirmed')} confirmed</div></div>
      </div>
      <div class="dash-grid">
        <div class="block chart-card"><div class="block-h"><h3>Applications per day</h3><span>Last 30 days</span></div><div class="chart-wrap">${columnChart(points)}</div></div>
        <div class="block"><div class="block-h"><h3>Pipeline</h3><span>All open jobs</span></div><div class="funnel">${funnel.map(([l, v], i) => `<div class="f-row" data-tip="<b>${esc(l)}</b><br>${v} candidates · ${Math.round((v / Math.max(1, funnel[0][1])) * 100)}% of applicants"><span class="f-l">${esc(l)}</span><div class="f-track"><div class="f-bar" style="width:${Math.max(2, (v / Math.max(1, funnel[0][1])) * 100)}%;background:${RAMP[i]}"></div></div><b>${v}</b><span class="f-p">${Math.round((v / Math.max(1, funnel[0][1])) * 100)}%</span></div>`).join('')}</div></div>
      </div>
      <div class="dash-grid">
        <div class="block"><div class="block-h"><h3>Sources</h3><span>Which job boards are worth paying for</span></div>
          <table class="src"><thead><tr><th>Source</th><th>Applications</th><th class="num">Strong matches</th><th class="num">Strong rate</th><th class="num">Shortlisted</th></tr></thead>
          <tbody>${src.map((x) => `<tr data-tip="<b>${esc(x.s)}</b><br>${x.n} applications · ${x.strong} strong matches"><td><b>${esc(x.s)}</b></td><td><div class="inbar"><span style="width:${(x.n / maxSrc) * 100}%"></span><b>${x.n}</b></div></td><td class="num">${x.strong}</td><td class="num">${Math.round((x.strong / x.n) * 100)}%</td><td class="num">${x.short}</td></tr>`).join('')}</tbody></table>
          ${insight ? `<div class="insight-line">${icon('sparkles', 15)}${esc(insight)}</div>` : ''}</div>
        <div class="block"><div class="block-h"><h3>Team</h3><span>This month</span></div>
          <div class="team">${DB.team.map((u) => { const own = APPS.filter((a) => a.owner === u.id); return `<div class="tm">${userAv(u.id)}<div class="tm-n"><b>${esc(u.name)}</b><span>${esc(u.desk)}</span></div><div class="tm-s"><b>${own.length}</b><span>Candidates</span></div><div class="tm-s"><b>${count(own, (a) => ['shortlisted', 'interview'].includes(a.decision))}</b><span>Shortlisted</span></div><div class="tm-s"><b>${count(own, (a) => a.decision === 'interview')}</b><span>Interviews</span></div></div>`; }).join('')}</div></div>
      </div>
      <div class="dash-grid">
        <div class="block"><div class="block-h"><h3>Open jobs</h3><a class="link-sm" href="#/jobs">All jobs ${icon('right', 13)}</a></div>
          <table class="src jobs-mini"><thead><tr><th>Job</th><th class="num">Applicants</th><th class="num">Strong</th><th class="num">Shortlisted</th><th class="num">Interviews</th><th>Closing</th></tr></thead>
          <tbody>${DB.jobs.filter((j) => j.status === 'Open').map((j) => { const st = jobStats(j); return `<tr class="click" data-href="#/jobs/${j.id}"><td><div class="two"><b>${esc(j.title)}</b><span>${esc(CLIENT(j.clientId).name)}</span></div></td><td class="num">${st.applicants}</td><td class="num">${st.strong}</td><td class="num">${st.shortlisted}</td><td class="num">${st.interviews}</td><td class="muted nowrap">${esc(until(j.closesAt).replace('closes ', ''))}</td></tr>`; }).join('')}</tbody></table></div>
        <div class="block"><div class="block-h"><h3>Recent activity</h3></div>
          <ul class="feed">${feed.map((e) => `<li data-open="cand:${e.cand.id}">${userAv(e.by, 'xs')}<div><span><b>${esc(byName(e.by))}</b> · ${esc(e.text)} · <b>${esc(e.cand.name)}</b></span><time>${ago(e.at)}</time></div></li>`).join('')}</ul></div>
      </div>`;
    ui.panelListFallback = feed.map((e) => e.cand.id);
  };

  // ================================================================== candidate actions (sample)
  const addEvent = (c, text, by = ME.id) => { (c.events = c.events || []).push({ at: new Date().toISOString(), by, text }); };
  const addOutbox = (m) => { DB.outbox.unshift({ id: `M${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}`, at: new Date().toISOString(), ...m }); };
  const decline = (c) => {
    const j = jobOf(c);
    if (!j || DB.automations.declines !== 'draft' || DB.outbox.some((m) => m.candId === c.id && m.kind === 'decline')) return false;
    addOutbox({ channel: 'Email', kind: 'decline', toName: c.name, to: c.email, candId: c.id, jobId: c.jobId, status: 'Draft', subject: `Your application: ${j.title}`, body: declineText(c) });
    return true;
  };
  const setStage = async (c, d, { toggle = true, silent = false } = {}) => {
    if (!c) return;
    if (toggle && c.decision === d) d = 'new';
    if (c.decision === d) return;
    if (SAMPLE_MODE && d === 'interview' && !c.interview) { openScheduler(c); return; }
    const before = c.decision;
    c.decision = d;
    if (SAMPLE_MODE) {
      addEvent(c, `Moved to ${stageLabel(d)}`);
      const drafted = d === 'not_now' && decline(c);
      save(); renderAll();
      if (!silent) toast(`${c.name} moved to ${stageLabel(d)}${drafted ? '. Decline email drafted in Outbox' : ''}`);
      return;
    }
    renderAll();
    try {
      // The sandboxed page has an opaque origin, so the reply can't be read; no-cors still delivers the request.
      await fetch(`${S.base}/webhook/applications/mark?id=${encodeURIComponent(c.id)}&d=${d}`, { mode: 'no-cors' });
      if (!silent) toast(`${c.name} moved to ${stageLabel(d)}`);
    } catch {
      c.decision = before; renderAll(); toast('Could not save. Is n8n running?', false);
    }
  };
  const requestDocs = (c) => {
    const missing = c.docs.filter((d) => d.state === 'missing');
    if (!missing.length) return toast('Every document has already been requested', false);
    missing.forEach((d) => { d.state = 'requested'; });
    const j = jobOf(c);
    addOutbox({ channel: 'Email', kind: 'docs', toName: c.name, to: c.email, candId: c.id, jobId: c.jobId, status: 'Sent', subject: `Documents needed: ${j.title}`, body: `Hi ${c.first},\n\nTo put you forward for the ${j.title} role, please upload these through your secure link:\n\n${missing.map((d) => `• ${d.name}`).join('\n')}\n\nThanks,\n${ME.name}\nHarbourline Recruitment` });
    addEvent(c, `Requested documents: ${missing.map((d) => d.name).join(', ')}`);
    save(); renderAll();
    toast(`Upload link sent to ${c.first} for ${missing.length} document${missing.length === 1 ? '' : 's'}`);
  };
  const addFromPool = (p, job, { silent = false } = {}) => {
    if (p.addedTo.includes(job.id)) return false;
    const id = `C${String(APPS.length + 1 + Math.floor(Math.random() * 900)).padStart(3, '0')}${p.id}`;
    const c = {
      id, name: p.name, first: p.first, email: p.email, phone: p.phone, at: new Date().toISOString(), jobId: job.id, role: job.family, roleGuessed: false,
      status: 'done', decision: 'new', source: 'Talent pool', why: `Re-matched from the talent pool (${p.history.toLowerCase()})`,
      cv: 'demo', cvName: `${p.first}_${p.name.split(' ')[1]}_CV.pdf`, cvNote: '', cover: '',
      summary: p.summary, title: p.title, exp: p.exp, loc: p.loc, avail: p.availability === 'Available' ? 'Immediate' : 'Ask candidate', salary: '',
      skills: p.skills, must: p.must, nice: p.nice, qs: p.qs, model: 'gpt-5-mini', tokens: 2100, error: '', aiSeconds: 4,
      rtw: p.rtw, owner: ME.id, docs: job.compliance.map((name) => ({ name, state: 'missing' })), notes: [], messages: [...(p.messages || [])], interview: null, dup: '',
      events: [{ at: new Date().toISOString(), by: ME.id, text: `Added from the talent pool with a match of ${p.score}` }],
    };
    rescore(c);
    APPS.unshift(c);
    p.addedTo.push(job.id);
    if (!silent) { save(); renderAll(); toast(`${p.name} added to ${job.title}`); }
    return true;
  };

  // ================================================================== side panel
  const openPanel = (kind, id) => {
    ui.panel = { kind, id, list: ui.panelListFallback || [] };
    $('panel').classList.add('open'); $('scrim').classList.add('open'); $('panel').setAttribute('aria-hidden', 'false');
    renderAll();
    const body = $('panel').querySelector('.p-body'); if (body) body.scrollTop = 0;
  };
  const closePanel = () => {
    ui.panel = null;
    $('panel').classList.remove('open'); $('scrim').classList.remove('open'); $('panel').setAttribute('aria-hidden', 'true');
    renderAll();
  };
  const movePanel = (step) => {
    if (!ui.panel) return;
    const list = ui.panel.list;
    const next = list[list.indexOf(ui.panel.id) + step];
    if (!next) return;
    ui.panel.id = next;
    renderAll();
    const body = $('panel').querySelector('.p-body'); if (body) body.scrollTop = 0;
  };
  const checks = (items) => `<ul class="checks">${items.map((c) => `<li><span class="ck ${esc(c.s)}">${c.s === 'met' ? I.check : c.s === 'missing' ? I.x : I.help}</span><div><div class="it">${esc(c.i)}</div>${c.e && c.s !== 'unclear' ? `<div class="ev">${esc(c.e)}</div>` : ''}</div></li>`).join('')}</ul>`;
  const metOf = (items) => items.filter((c) => c.s === 'met').length;
  const tally = (items) => { const n = (s) => items.filter((c) => c.s === s).length; return `${n('met')} met · ${n('missing')} missing · ${n('unclear')} unclear`; };
  const thread = (msgs) => `<div class="thread">${msgs.map((m) => `<div class="bubble ${m.dir}"><div>${esc(m.text)}</div><span>${esc(m.channel)} · ${esc(ago(m.at))}${m.dir === 'out' && m.by ? ` · ${esc(byName(m.by))}` : ''}</span></div>`).join('')}</div>`;
  const mentionify = (t) => esc(t).replace(/@([A-Za-z]+)/g, '<span class="mention">@$1</span>');

  const scoreCard = (a, label) => {
    const mustMet = metOf(a.must || []), niceMet = metOf(a.nice || []);
    return `<div class="block tier-${a.tier.key}"><div class="score-card">${ring(a.score, a.tier.key, 'lg')}
      <div><h3>${a.tier.label}</h3><p>Scored against the ${esc(label)} checklist: must-haves count 80%, nice-to-haves 20%.</p>
        <div class="bar-row"><span>Must-haves</span><div class="bar"><span style="width:${(mustMet / Math.max(1, a.must.length)) * 100}%"></span></div><b>${mustMet}/${a.must.length}</b></div>
        ${a.nice && a.nice.length ? `<div class="bar-row"><span>Nice-to-haves</span><div class="bar"><span style="width:${(niceMet / a.nice.length) * 100}%"></span></div><b>${niceMet}/${a.nice.length}</b></div>` : ''}</div></div></div>`;
  };
  const summaryBlock = (a, facts) => `<div class="block"><div class="block-h"><h3>AI summary</h3><span>${esc(a.model || 'gpt-5-mini')}${a.tokens ? ` · ${Number(a.tokens).toLocaleString('en-GB')} tokens` : ''}</span></div>
    <div class="summary">${esc(a.summary)}</div>${facts.length ? `<dl class="facts">${facts.map(([k, v]) => `<div class="fact"><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>` : ''}</div>`;

  const renderPanel = () => {
    if (!ui.panel) { $('panel').innerHTML = ''; return; }
    const isPool = ui.panel.kind === 'pool';
    const a = isPool ? DB.pool.find((p) => p.id === ui.panel.id) : APPS.find((x) => x.id === ui.panel.id);
    if (!a) { closePanel(); return; }
    const list = ui.panel.list.length ? ui.panel.list : [a.id];
    const pos = Math.max(0, list.indexOf(a.id));
    const nav = `<div class="p-top"><span>${list.length > 1 ? `${pos + 1} of ${list.length.toLocaleString('en-GB')}` : ''}</span>
      <div class="nav-btns"><button class="btn icon sm" data-move="-1" title="Previous (↑)" ${pos > 0 ? '' : 'disabled'}>${I.up}</button><button class="btn icon sm" data-move="1" title="Next (↓)" ${pos < list.length - 1 ? '' : 'disabled'}>${I.down}</button><button class="btn icon sm" data-close title="Close (Esc)">${I.x}</button></div></div>`;
    if (isPool) {
      const sameFamily = DB.jobs.filter((j) => j.status === 'Open' && j.family === a.family);
      $('panel').innerHTML = `${nav}<div class="p-body">
        <div class="p-head">${avatar(a, 'lg')}<div style="min-width:0"><h2>${esc(a.name)}</h2><div class="sub"><a href="mailto:${esc(a.email)}">${esc(a.email)}</a><span>${esc(a.phone)}</span></div></div></div>
        <div class="p-tags"><span class="badge brand">${I.database}Talent pool</span>${availBadge(a.availability)}${rtwBadge(a.rtw)}</div>
        <div class="p-actions">
          ${sameFamily.length ? `<select class="select sm" id="pool-add-job">${sameFamily.map((j) => `<option value="${j.id}">${esc(j.title)} · ${esc(CLIENT(j.clientId).name)}</option>`).join('')}</select><button class="btn primary" data-add-pool-panel="${a.id}">${I.userPlus}Add to job</button>` : ''}
          <button class="btn" data-msg-pool="${a.id}">${I.chat}Message</button>
        </div>
        ${scoreCard(a, a.family)}
        ${summaryBlock(a, [['Current title', a.title], ['Experience', a.exp], ['Location', a.loc], ['Last activity', `${a.history} · ${ago(a.lastContact)}`]])}
        <div class="block"><div class="block-h"><h3>Skills found in the CV</h3></div><div class="skills chips">${a.skills.map((s) => `<span class="chip">${esc(s)}</span>`).join('')}</div></div>
        <div class="block"><div class="block-h"><h3>Must-haves</h3><span>${tally(a.must)}</span></div>${checks(a.must)}</div>
        ${a.messages && a.messages.length ? `<div class="block"><div class="block-h"><h3>Messages</h3></div>${thread(a.messages)}</div>` : ''}
        ${a.addedTo.length ? `<div class="block"><div class="block-h"><h3>Added to</h3></div><ul class="doc-list">${a.addedTo.map((jid) => `<li>${icon('briefcase', 15)}${esc(JOB(jid).title)} · ${esc(CLIENT(JOB(jid).clientId).name)}</li>`).join('')}</ul></div>` : ''}
        <p class="policy">Scores come from the job's checklist, item by item, so every score can be explained. Your team makes every decision.</p>
      </div>`;
      return;
    }
    const j = jobOf(a), cl = clientOf(a);
    const facts = [['Current title', a.title], ['Experience', a.exp], ['Location', a.loc], ['Notice period', a.avail], ['Expectation', a.salary]].filter(([, v]) => !notStated(v));
    let ai;
    if (a.status === 'done') {
      ai = `${scoreCard(a, j ? j.title : a.role)}${summaryBlock(a, facts)}`;
    } else if (a.status === 'error') {
      ai = `<div class="note err">${I.alert}<div><b>The AI summary failed</b><p>${esc(a.error)} It will be retried on the next Summarise.</p></div></div>`;
    } else if (a.status === 'waiting') {
      ai = `<div class="note">${I.sparkles}<div><b>Not summarised yet</b><p>${S.ai.on ? 'Click "Summarise" at the top of the page to read the next batch of CVs.' : 'Turn on AI summaries (bottom left), then click "Summarise".'}</p></div></div>`;
    } else {
      ai = `<div class="note">${I.info}<div><b>Nothing for the AI to read</b><p>${esc(a.cvNote || 'This application has no CV text.')}</p></div></div>`;
    }
    const DOC_ICON = { received: ['check', 'Received'], requested: ['clock', 'Requested'], missing: ['x', 'Not requested'] };
    const compliance = SAMPLE_MODE && a.rtw ? `<div class="block"><div class="block-h"><h3>Right to work & compliance</h3>${a.docs.some((d) => d.state === 'missing') ? `<button class="btn sm" data-request-docs>${I.send}Request missing</button>` : `<span>${count(a.docs, (d) => d.state === 'received')} of ${a.docs.length} received</span>`}</div>
      <div class="rtw-row">${rtwBadge(a.rtw)}<span>${esc(a.rtw.detail)}. Always confirm with a share code or document check before the candidate starts.</span></div>
      <ul class="docs">${a.docs.map((d, i) => `<li class="doc-${d.state}"><span class="ds">${icon(DOC_ICON[d.state][0], 13, 'stroke-width="2.4"')}</span><span class="dn">${esc(d.name)}</span><span class="dst">${DOC_ICON[d.state][1]}</span>${d.state !== 'received' ? `<button class="link-btn" data-doc-received="${i}">Mark received</button>` : ''}</li>`).join('')}</ul></div>` : '';
    const interview = SAMPLE_MODE && a.interview ? `<div class="iv-card">${icon('calendar', 18)}<div><b>${esc(fmt(a.interview.at, { weekday: 'long', day: 'numeric', month: 'long' }))} at ${esc(time(a.interview.at))}</b><span>${esc(a.interview.format)} · ${a.interview.duration} min · with ${esc(a.interview.with.join(', '))}</span></div>${a.interview.status === 'Confirmed' ? `<span class="badge green">${I.check}Confirmed</span>` : `<span class="badge amber">${I.clock}Awaiting reply</span>`}<button class="btn sm" data-schedule>Reschedule</button></div>` : '';
    const others = DB.team.filter((u) => u.id !== ME.id);
    $('panel').innerHTML = `${nav}<div class="p-body">
      <div class="p-head">${avatar(a, 'lg')}<div style="min-width:0"><h2>${esc(a.name)}</h2>
        <div class="sub">${a.email ? `<a href="mailto:${esc(a.email)}">${esc(a.email)}</a>` : ''}${a.phone ? `<span>${esc(a.phone)}</span>` : ''}<span>Applied ${esc(ago(a.at).toLowerCase())}${a.source ? ` via ${esc(a.source)}` : ''}</span></div></div></div>
      <div class="p-tags">${j ? `<a class="badge brand" href="#/jobs/${j.id}">${I.briefcase}${esc(j.title)} · ${esc(cl.name)}</a>` : `<span class="badge brand">${I.briefcase}${esc(a.role)}${a.roleGuessed ? ' · AI guess' : ''}</span>`}${stageBadge(a)}${a.dup ? `<span class="badge amber">${esc(a.dup)}</span>` : ''}</div>
      ${SAMPLE_MODE ? `<div class="owner-row"><span>Owner</span>${userAv(a.owner, 'xs')}<select class="select sm" data-owner>${DB.team.map((u) => `<option value="${u.id}" ${a.owner === u.id ? 'selected' : ''}>${esc(u.name)}${u.id === ME.id ? ' (you)' : ''}</option>`).join('')}</select></div>` : ''}
      <div class="segmented" role="group" aria-label="Stage">${STAGES.map(([v, l, ic]) => `<button class="${a.decision === v ? 'on' : ''}" data-mark="${v}">${I[ic]}${l}</button>`).join('')}</div>
      <div class="p-actions">
        ${a.cv ? `<button class="btn" data-cv>${I.file}View CV</button>` : ''}
        ${SAMPLE_MODE ? `<button class="btn" data-msg>${I.chat}Message</button><button class="btn" data-schedule>${I.calendar}${a.interview ? 'Reschedule' : 'Schedule interview'}</button>` : ''}
        ${a.status === 'done' ? `<button class="btn" data-draft="decline">${I.mail}Draft decline</button>` : ''}
      </div>
      ${interview}
      ${ai}
      ${compliance}
      ${a.skills && a.skills.length ? `<div class="block"><div class="block-h"><h3>Skills found in the CV</h3></div><div class="skills chips">${a.skills.map((s) => `<span class="chip">${esc(s)}</span>`).join('')}</div></div>` : ''}
      ${a.must && a.must.length ? `<div class="block"><div class="block-h"><h3>Must-haves</h3><span>${tally(a.must)}</span></div>${checks(a.must)}</div>` : ''}
      ${a.nice && a.nice.length ? `<div class="block"><div class="block-h"><h3>Nice-to-haves</h3><span>${tally(a.nice)}</span></div>${checks(a.nice)}</div>` : ''}
      ${a.qs && a.qs.length ? `<div class="block"><div class="block-h"><h3>Suggested interview questions</h3></div><ol class="qs">${a.qs.map((x) => `<li>${esc(x)}</li>`).join('')}</ol></div>` : ''}
      ${SAMPLE_MODE ? `<div class="block"><div class="block-h"><h3>Messages</h3><button class="btn sm" data-msg>${I.chat}New message</button></div>${a.messages && a.messages.length ? thread(a.messages) : '<p class="empty-sm">No messages yet. Send a WhatsApp or SMS to check interest or availability.</p>'}</div>
      <div class="block"><div class="block-h"><h3>Team notes</h3><span>${(a.notes || []).length}</span></div>
        <ul class="notes">${(a.notes || []).map((n) => `<li>${userAv(n.by, 'xs')}<div><div class="nh"><b>${esc(byName(n.by))}</b><time>${ago(n.at)}</time></div><p>${mentionify(n.text)}</p></div></li>`).join('')}</ul>
        <div class="composer"><textarea id="note-text" rows="2" placeholder="Add a note for the team… use @ to mention someone"></textarea>
          <div class="composer-f"><div class="mentions">${others.map((u) => `<button class="chip btnchip" data-mention="${esc(firstOf(u.name))}">@${esc(firstOf(u.name))}</button>`).join('')}</div><button class="btn sm primary" data-add-note>Add note</button></div></div></div>
      <div class="block"><div class="block-h"><h3>Activity</h3></div><ul class="timeline">${[...(a.events || [])].sort((x, y) => String(x.at).localeCompare(String(y.at))).map((e) => `<li><span class="tdot" style="--tdc:${e.by === 'system' ? '#6e41e2' : USER_COLOURS[e.by] || '#94a3b8'}"></span><span>${esc(e.text)}<em> · ${esc(byName(e.by))}</em></span><time>${esc(ago(e.at))}</time></li>`).join('')}</ul></div>` : ''}
      <div class="block"><div class="block-h"><h3>Application</h3></div>
        <dl class="meta">${a.subject ? `<dt>Email subject</dt><dd>${esc(a.subject)}</dd>` : ''}<dt>CV</dt><dd>${a.cv ? esc(a.cvName || 'On file') : esc(a.cvNote || 'None')}</dd><dt>Picked up because</dt><dd>${esc(a.why)}</dd></dl>
        ${a.cover ? `<div class="cover">${esc(a.cover)}</div>` : ''}</div>
      <p class="policy">The match score comes from the job's checklist, item by item, so every score can be explained. Your team makes every hiring decision.</p>
      <div class="keys"><span><kbd>↑</kbd> <kbd>↓</kbd> previous / next</span><span><kbd>S</kbd> shortlist</span><span><kbd>I</kbd> interview</span><span><kbd>N</kbd> not now</span><span><kbd>Esc</kbd> close</span></div>
    </div>`;
  };

  // ================================================================== modals
  const openModal = (html, cls = '') => { $('modal').innerHTML = `<div class="modal ${cls}" role="dialog" aria-modal="true">${html}</div>`; $('modal').classList.add('open'); };
  const closeModal = () => { $('modal').classList.remove('open'); $('modal').innerHTML = ''; modalState = null; };
  let modalState = null;
  const modalHead = (title, sub) => `<div class="modal-h"><div><h3>${title}</h3>${sub ? `<p>${sub}</p>` : ''}</div><button class="btn icon sm" data-close-modal>${I.x}</button></div>`;

  // ---------- drafts (decline / invite text)
  const declineText = (a) => { const j = jobOf(a); const role = j ? j.title : a.role; return `Subject: Your application for the ${role} role\n\nHi ${a.first || firstOf(a.name)},\n\nThank you for your interest in the ${role} role and for the time you put into your application.\n\nWe've reviewed it carefully and have decided to move forward with candidates whose experience more closely matches what this role needs right now. This was not an easy decision.\n\nWe'll keep your details on file and may contact you about future roles that fit your background.\n\nWe wish you every success,\n${SAMPLE_MODE ? DB.agency : 'Forrof Hiring Team'}`; };
  const openDraft = (a) => {
    modalState = { kind: 'draft', id: a.id };
    openModal(`${modalHead('Polite decline', `Drafted by AI for ${esc(a.name)}. Review and edit before you send it.`)}
      <textarea id="draft" class="modal-text">${esc(declineText(a))}</textarea>
      <div class="modal-f"><span>Not sent automatically</span><div class="btns"><button class="btn" data-close-modal>Close</button>${SAMPLE_MODE ? `<button class="btn" data-draft-save>${I.send}Save to Outbox</button>` : ''}<button class="btn primary" data-copy>${I.copy}Copy email</button></div></div>`);
  };

  // ---------- interview scheduler
  const workdays = (n) => { const out = []; const d = new Date(); while (out.length < n) { d.setDate(d.getDate() + 1); if (![0, 6].includes(d.getDay())) out.push(new Date(d)); } return out; };
  const SLOT_TIMES = ['09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '12:00', '13:30', '14:00', '14:30', '15:00', '15:30', '16:00', '16:30'];
  const isBusy = (dayIdx, slot, c) => {
    const h = [...`${c.id}${dayIdx}${slot}`].reduce((s, ch) => (s * 33 + ch.charCodeAt(0)) >>> 0, 5);
    return h % 4 === 0;
  };
  const openScheduler = (c) => {
    const cl = clientOf(c);
    modalState = { kind: 'schedule', id: c.id, day: 0, slot: '', format: 'Video call (Teams)', duration: 45, with: [USER(c.owner).name, cl.contact] };
    renderScheduler();
  };
  const renderScheduler = () => {
    const st = modalState; const c = APPS.find((x) => x.id === st.id); const j = jobOf(c), cl = clientOf(c);
    const days = workdays(5);
    const people = [...DB.team.map((u) => u.name), cl.contact];
    openModal(`${modalHead(`${c.interview ? 'Reschedule' : 'Schedule'} interview`, `${esc(c.name)} · ${esc(j.title)} at ${esc(cl.name)}`)}
      <div class="sched">
        <div class="sched-l">
          <label>Interviewers</label><div class="chips">${people.map((p) => `<button class="chip btnchip ${st.with.includes(p) ? 'on' : ''}" data-sched-with="${esc(p)}">${st.with.includes(p) ? '✓ ' : ''}${esc(p)}</button>`).join('')}</div>
          <label>Format</label><div class="radio-list">${['Video call (Teams)', 'Phone', 'On-site at client'].map((f) => `<button class="radio ${st.format === f ? 'on' : ''}" data-sched-format="${f}">${icon(/Video/.test(f) ? 'video' : /Phone/.test(f) ? 'phone' : 'building', 15)}${f}</button>`).join('')}</div>
          <label>Length</label><div class="seg-inline small">${[30, 45, 60].map((m) => `<button class="${st.duration === m ? 'on' : ''}" data-sched-dur="${m}">${m} min</button>`).join('')}</div>
        </div>
        <div class="sched-r">
          <div class="day-tabs">${days.map((d, i) => `<button class="${st.day === i ? 'on' : ''}" data-sched-day="${i}"><span>${d.toLocaleDateString('en-GB', { weekday: 'short' })}</span><b>${d.getDate()}</b></button>`).join('')}</div>
          <div class="slots">${SLOT_TIMES.map((t) => { const busy = isBusy(st.day, t, c); return `<button class="slot ${st.slot === t ? 'on' : ''}" data-sched-slot="${t}" ${busy ? 'disabled title="Someone is busy"' : ''}>${t}</button>`; }).join('')}</div>
          <p class="hint">Times are UK time. Greyed-out slots clash with an interviewer's calendar.</p>
        </div>
      </div>
      <div class="modal-f"><span>Invite goes to ${esc(c.email)} and ${esc(cl.contact)}</span><div class="btns"><button class="btn" data-close-modal>Cancel</button><button class="btn primary" data-sched-send ${st.slot && st.with.length ? '' : 'disabled'}>${I.send}Send invite</button></div></div>`, 'wide');
  };
  const sendInvite = () => {
    const st = modalState; const c = APPS.find((x) => x.id === st.id); const j = jobOf(c), cl = clientOf(c);
    const d = workdays(5)[st.day]; const [hh, mm] = st.slot.split(':').map(Number);
    const at = londonTime(d, hh, mm).toISOString();
    const moved = !!c.interview;
    c.interview = { at, format: st.format, duration: st.duration, with: [...st.with], status: 'Awaiting reply' };
    if (c.decision !== 'interview') { c.decision = 'interview'; addEvent(c, 'Moved to Interview'); }
    const label = `${fmt(at, { weekday: 'short', day: 'numeric', month: 'short' })} at ${time(at)}`;
    addEvent(c, `${moved ? 'Interview moved to' : 'Interview booked for'} ${label}`);
    addOutbox({ channel: 'Email', kind: 'invite', toName: c.name, to: c.email, candId: c.id, jobId: c.jobId, status: 'Sent', subject: `Interview: ${j.title} with ${cl.name}`, body: `Hi ${c.first},\n\nGreat news: ${cl.name} would like to interview you for the ${j.title} role.\n\n${fmt(at, { weekday: 'long', day: 'numeric', month: 'long' })} at ${time(at)} · ${st.format} · ${st.duration} minutes\nWith: ${st.with.join(', ')}\n\nPlease reply to confirm.\n\nBest wishes,\n${ME.name}\nHarbourline Recruitment` });
    addOutbox({ channel: 'Email', kind: 'invite', toName: cl.contact, to: cl.email, candId: c.id, jobId: c.jobId, status: 'Sent', subject: `Calendar invite: ${c.name} for ${j.title}`, body: `Hi ${firstOf(cl.contact)},\n\nI've booked ${c.name} for ${label} (${st.format}, ${st.duration} minutes). The candidate summary is in the shortlist link.\n\nBest wishes,\n${ME.name}` });
    closeModal(); save(); renderAll();
    toast(`Interview booked for ${label}. Invites sent to ${c.first} and ${firstOf(cl.contact)}`);
    // Sample workspace: the candidate confirms a few seconds later.
    setTimeout(() => {
      if (!c.interview || c.interview.at !== at) return;
      c.interview.status = 'Confirmed';
      c.messages = c.messages || [];
      c.messages.push({ at: new Date().toISOString(), dir: 'in', channel: 'Email', text: `Thanks! ${label} works for me. See you then.` });
      addEvent(c, 'Candidate confirmed the interview', 'system');
      save(); renderAll(); toast(`${c.first} confirmed the interview`);
    }, 4500);
  };

  // ---------- WhatsApp / SMS
  const TEMPLATES = {
    interest: { label: 'Check interest', text: (_p, j, cl) => `Hi {first}, it's ${firstOf(ME.name)} from Harbourline Recruitment. Are you still interested in the ${j ? `${j.title} role with ${cl.name}` : 'role you applied for'}?` },
    availability: { label: 'Check availability', text: (_p, j) => `Hi {first}, it's ${firstOf(ME.name)} from Harbourline Recruitment. We have ${j ? `${an(j.title)} ${j.title} role (${j.location}, ${j.pay})` : 'a new role'} that fits your background. Are you open to new opportunities at the moment?` },
    reminder: { label: 'Interview reminder', text: () => 'Hi {first}, a quick reminder of your interview {when}. Reply YES to confirm, or let me know if you need to move it.' },
    documents: { label: 'Documents reminder', text: () => 'Hi {first}, could you upload your outstanding documents using the secure link we emailed? It only takes a couple of minutes. Thanks!' },
  };
  const REPLIES = {
    interest: [['Yes, still very interested! When can we talk?', 'Available'], ['Yes please. I\'m free after 5pm most days.', 'Available'], ['Thanks, but I\'ve just accepted another offer.', 'Not looking']],
    availability: [['Yes, I\'m open to it. Can you send more details?', 'Available'], ['Possibly. I could start in about a month.', 'Available in 1 month'], ['Thanks, but I\'m happy where I am for now.', 'Not looking'], ['Yes! I\'m actively looking at the moment.', 'Available']],
    reminder: [['YES, confirmed. See you then.', ''], ['Confirmed, thanks for the reminder!', '']],
    documents: [['Done, just uploaded them now.', ''], ['Will do this evening, thanks.', '']],
  };
  const openMessage = (targets, kind) => {
    const first = targets[0];
    const j = kind === 'cand' ? jobOf(first) : JOB(ui.pool.jobId) || DB.jobs.find((x) => x.status === 'Open' && x.family === first.family);
    const cl = j ? CLIENT(j.clientId) : null;
    const tpl = kind === 'pool' ? 'availability' : first.interview ? 'reminder' : first.docs && first.docs.some((d) => d.state === 'requested') ? 'documents' : 'interest';
    modalState = { kind: 'message', targetKind: kind, ids: targets.map((t) => t.id), channel: 'WhatsApp', tpl, jobId: j ? j.id : '', text: TEMPLATES[tpl].text(first, j, cl) };
    renderMessage();
  };
  const renderMessage = () => {
    const st = modalState;
    const people = st.ids.map((id) => (st.targetKind === 'pool' ? DB.pool : APPS).find((x) => x.id === id));
    openModal(`${modalHead(people.length > 1 ? `Message ${people.length} people` : `Message ${esc(people[0].name)}`, people.length > 1 ? 'Each message is personalised with their first name.' : esc(people[0].phone))}
      <div class="msg-body">
        <div class="seg-inline small">${['WhatsApp', 'SMS'].map((ch) => `<button class="${st.channel === ch ? 'on' : ''}" data-msg-channel="${ch}">${icon(ch === 'WhatsApp' ? 'chat' : 'phone', 14)}${ch}</button>`).join('')}</div>
        <div class="chips tpl">${Object.entries(TEMPLATES).map(([k, t]) => `<button class="chip btnchip ${st.tpl === k ? 'on' : ''}" data-msg-tpl="${k}">${t.label}</button>`).join('')}</div>
        <textarea id="msg-text" class="modal-text short">${esc(st.text)}</textarea>
        <p class="hint">{first} becomes each person's first name${st.text.includes('{when}') ? ', {when} their interview time' : ''}. Replies appear on the candidate's record.</p>
      </div>
      <div class="modal-f"><span>${people.length} recipient${people.length === 1 ? '' : 's'} · ${st.channel}</span><div class="btns"><button class="btn" data-close-modal>Cancel</button><button class="btn primary" data-msg-send>${I.send}Send</button></div></div>`);
  };
  const sendMessages = () => {
    const st = modalState;
    const text = $('msg-text').value;
    const people = st.ids.map((id) => (st.targetKind === 'pool' ? DB.pool : APPS).find((x) => x.id === id)).filter(Boolean);
    const tplKey = st.tpl;
    people.forEach((p, i) => {
      const body = text.replace(/\{first\}/g, p.first || firstOf(p.name)).replace(/\{when\}/g, p.interview ? `on ${fmt(p.interview.at, { weekday: 'long' })} at ${time(p.interview.at)}` : 'this week');
      p.messages = p.messages || [];
      p.messages.push({ at: new Date().toISOString(), dir: 'out', channel: st.channel, by: ME.id, text: body });
      addOutbox({ channel: st.channel, kind: 'message', toName: p.name, to: p.phone, candId: st.targetKind === 'cand' ? p.id : null, jobId: st.jobId, status: 'Delivered', subject: `${st.channel} message`, body });
      if (st.targetKind === 'cand') addEvent(p, `Sent a ${st.channel} message`);
      // Sample workspace: most people reply within a few seconds.
      const replies = REPLIES[tplKey];
      if (replies && (people.length === 1 || i % 4 !== 3)) {
        setTimeout(() => {
          const [reply, avail] = replies[(i + p.name.length) % replies.length];
          p.messages.push({ at: new Date().toISOString(), dir: 'in', channel: st.channel, text: reply });
          if (avail && st.targetKind === 'pool') p.availability = avail;
          if (st.targetKind === 'cand') addEvent(p, `${p.first} replied on ${st.channel}`, 'system');
          save(); renderAll();
          toast(`${st.channel} reply from ${p.name}: "${reply.slice(0, 48)}${reply.length > 48 ? '…' : ''}"`);
        }, 2200 + i * 1300);
      }
    });
    closeModal(); save(); renderAll();
    toast(`${st.channel} sent to ${people.length === 1 ? people[0].name : `${people.length} people`}`);
  };

  // ---------- talent pool scan
  const scanPool = (jobId) => {
    const j = JOB(jobId); if (!j) return;
    const family = DB.pool.filter((p) => p.family === j.family);
    openModal(`${modalHead('Re-matching your talent pool', `${esc(j.title)} · ${esc(CLIENT(j.clientId).name)}`)}
      <div class="scan"><div class="scan-icon">${icon('sparkles', 26)}</div><b id="scan-n">Reading CV 0 of ${DB.pool.length}</b><div class="progress"><span id="scan-bar"></span></div><p id="scan-t">Checking every past candidate against ${j.must.length} must-haves and ${j.nice.length} nice-to-haves…</p></div>`, 'narrow');
    let i = 0;
    const total = DB.pool.length;
    const tick = setInterval(() => {
      i = Math.min(total, i + Math.ceil(total / 22));
      const n = $('scan-n'), bar = $('scan-bar');
      if (!n) { clearInterval(tick); return; }
      n.textContent = `Reading CV ${i} of ${total}`;
      bar.style.width = `${(i / total) * 100}%`;
      if (i >= total) {
        clearInterval(tick);
        const matches = family.filter((p) => p.score >= 60).sort((a, b) => b.score - a.score);
        j.poolMatchIds = matches.map((p) => p.id);
        j.poolScannedAt = new Date().toISOString();
        save();
        setTimeout(() => {
          closeModal();
          ui.selected.clear();
          if (route().page === 'pool') { ui.pool.jobId = j.id; ui.pool.page = 0; renderAll(); } else { ui.jobTab = 'pool'; location.hash = `#/jobs/${j.id}`; renderAll(); }
          toast(`${matches.length} past candidates match ${j.title}`);
        }, 450);
      }
    }, 70);
  };

  // ---------- client-ready shortlist
  const shortlistDoc = (j, people) => {
    const cl = CLIENT(j.clientId), owner = USER(j.owner) || ME;
    const anon = (p) => `${p.first || firstOf(p.name)} ${String(p.name.split(' ')[1] || '').charAt(0)}.`;
    return `<div class="doc">
      <div class="doc-h"><div class="doc-brand"><div class="ws-mark">HR</div><div><b>${esc(DB.agency)}</b><span>Candidate shortlist</span></div></div><div class="doc-date">${esc(day(Date.now()))}</div></div>
      <h1>${esc(j.title)}</h1>
      <p class="doc-meta">${esc(cl.name)} · ${esc(j.location)} · ${esc(j.type)} · ${esc(j.pay)}</p>
      <p class="doc-intro">Prepared for ${esc(cl.contact)}, ${esc(cl.contactTitle)}. ${people.length} candidate${people.length === 1 ? '' : 's'}, each checked against your must-haves. Contact details are held by ${esc(DB.agency)}; ask ${esc(firstOf(owner.name))} to arrange interviews.</p>
      ${people.map((p, i) => `<div class="doc-c">
        <div class="doc-ch"><div><span class="doc-ref">Candidate ${i + 1} · Ref HR-${esc(p.id.replace(/\D/g, '').slice(-4).padStart(4, '0'))}</span><h2>${esc(anon(p))}</h2><p>${esc(p.title)} · ${esc(p.exp)} · ${esc(p.loc)}</p></div><div class="doc-score">${ring(p.score, p.tier.key, 'lg')}<span>${esc(p.tier.label)}</span></div></div>
        <p class="doc-sum">${esc(p.summary)}</p>
        <div class="doc-cols"><div><h4>Why they fit</h4><ul>${p.must.filter((c) => c.s === 'met').slice(0, 3).map((c) => `<li>${esc(c.e || c.i)}</li>`).join('') || '<li>See summary</li>'}</ul></div>
          <div><h4>To explore at interview</h4><ul>${[...p.must, ...p.nice].filter((c) => c.s !== 'met').slice(0, 2).map((c) => `<li>${esc(c.i)}</li>`).join('') || '<li>No gaps against the checklist</li>'}</ul></div></div>
        <div class="doc-facts"><span><b>Notice</b>${esc(p.avail)}</span><span><b>Expectation</b>${esc(p.salary || 'To discuss')}</span><span><b>Right to work</b>${esc(p.rtw ? p.rtw.label : 'To confirm')}</span></div>
      </div>`).join('')}
      <div class="doc-f">${esc(owner.name)} · ${esc(owner.title)} · ${esc(DB.agency)} · ${esc(firstOf(owner.name).toLowerCase())}@harbourline.example</div>
    </div>`;
  };
  const openShortlist = (jobId) => {
    const j = JOB(jobId);
    const people = sortList(APPS.filter((a) => a.jobId === jobId && ['shortlisted', 'interview'].includes(a.decision)), 'match');
    if (!people.length) return toast('Shortlist someone for this job first', false);
    modalState = { kind: 'shortlist', jobId };
    openModal(`${modalHead('Client shortlist', `${people.length} candidate${people.length === 1 ? '' : 's'} for ${esc(CLIENT(j.clientId).contact)}. Contact details are removed so the client books interviews through you.`)}
      <div class="doc-wrap">${shortlistDoc(j, people)}</div>
      <div class="modal-f"><span>Branded with ${esc(DB.agency)}</span><div class="btns"><button class="btn" data-sl-link>${I.link}Copy share link</button><button class="btn" data-sl-print>${I.printer}Download PDF</button><button class="btn primary" data-sl-send>${I.send}Email to ${esc(firstOf(CLIENT(j.clientId).contact))}</button></div></div>`, 'doc-modal');
  };
  // Prints only the shortlist document from this page ("Save as PDF" in the print dialog).
  const printShortlist = () => {
    const j = JOB(modalState.jobId);
    const people = sortList(APPS.filter((a) => a.jobId === j.id && ['shortlisted', 'interview'].includes(a.decision)), 'match');
    let root = $('print-root');
    if (!root) { root = Object.assign(document.createElement('div'), { id: 'print-root' }); document.body.appendChild(root); }
    root.innerHTML = shortlistDoc(j, people);
    document.body.classList.add('printing');
    const done = () => { document.body.classList.remove('printing'); window.removeEventListener('afterprint', done); };
    window.addEventListener('afterprint', done);
    setTimeout(() => window.print(), 50);
  };
  // The Clipboard API isn't available on the sandboxed page; fall back to a hidden textarea.
  const copyText = async (text) => {
    try { await navigator.clipboard.writeText(text); return true; } catch { /* fall back */ }
    const ta = Object.assign(document.createElement('textarea'), { value: text });
    ta.style.cssText = 'position:fixed;opacity:0;top:0;left:0';
    document.body.appendChild(ta); ta.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch { ok = false; }
    ta.remove();
    return ok;
  };
  const sendShortlist = () => {
    const j = JOB(modalState.jobId), cl = CLIENT(j.clientId);
    const people = APPS.filter((a) => a.jobId === j.id && ['shortlisted', 'interview'].includes(a.decision));
    addOutbox({ channel: 'Email', kind: 'shortlist', toName: cl.contact, to: cl.email, candId: null, jobId: j.id, status: 'Sent', subject: `Shortlist: ${j.title} (${people.length} candidates)`, body: `Hi ${firstOf(cl.contact)},\n\nHere's the shortlist for the ${j.title} role: ${people.length} candidates, each with a short summary and how they match your checklist.\n\nOpen the shortlist: https://share.harbourline.example/s/${j.id.toLowerCase()}-${Date.now().toString(36).slice(-4)}\n\nBest wishes,\n${ME.name}\nHarbourline Recruitment` });
    people.forEach((p) => addEvent(p, `Sent to ${cl.name} in a shortlist`));
    closeModal(); save(); renderAll();
    toast(`Shortlist emailed to ${cl.contact}`);
  };

  // ---------- new job
  const openNewJob = () => {
    modalState = { kind: 'newjob' };
    openModal(`${modalHead('New job', 'Applications for this job are screened against its checklist automatically.')}
      <div class="form">
        <label>Job title<input id="nj-title" class="input" placeholder="e.g. Senior QA Engineer" value="Senior QA Engineer"></label>
        <div class="form-row"><label>Client<select id="nj-client" class="select">${DB.clients.map((c) => `<option value="${c.id}">${esc(c.name)}</option>`).join('')}</select></label>
          <label>Location<input id="nj-loc" class="input" value="Manchester · Hybrid"></label></div>
        <div class="form-row"><label>Type<select id="nj-type" class="select"><option>Permanent</option><option>Contract · 6 months</option><option>Temp · 3 months</option></select></label>
          <label>Pay<input id="nj-pay" class="input" value="£45k–52k"></label></div>
        <div class="form-row"><label>Screening checklist<select id="nj-family" class="select">${Object.keys(FAMILIES).map((f) => `<option ${f === 'QA Engineer / SDET' ? 'selected' : ''}>${esc(f)}</option>`).join('')}</select></label>
          <label>Consultant<select id="nj-owner" class="select">${DB.team.map((u) => `<option value="${u.id}">${esc(u.name)}</option>`).join('')}</select></label></div>
        <div class="nj-preview" id="nj-preview"></div>
      </div>
      <div class="modal-f"><span>You can re-match the talent pool straight after.</span><div class="btns"><button class="btn" data-close-modal>Cancel</button><button class="btn primary" data-nj-create>${I.plus}Create job</button></div></div>`);
    const preview = () => { const f = FAMILIES[$('nj-family').value]; $('nj-preview').innerHTML = `<h5>Must-haves the AI will check</h5><ol>${f.must.map((m) => `<li>${esc(m[0])}</li>`).join('')}</ol>`; };
    $('nj-family').addEventListener('change', preview); preview();
    $('nj-title').focus();
  };
  const createJob = () => {
    const title = $('nj-title').value.trim() || 'New job';
    const family = $('nj-family').value, type = $('nj-type').value;
    const id = `J${110 + DB.jobs.length}`;
    const compliance = type.startsWith('Temp') ? ['Right to work check', 'Proof of ID', 'Proof of address', 'National Insurance number', 'Bank details for payroll'] : type.startsWith('Contract') ? ['Right to work check', 'Proof of ID', 'IR35 status form'] : ['Right to work check', 'Two references', 'Qualifications'];
    const loc = $('nj-loc').value.trim();
    const job = { id, title, clientId: $('nj-client').value, family, city: loc.split('·')[0].trim(), workType: (loc.split('·')[1] || '').trim(), type, pay: $('nj-pay').value.trim(), owner: $('nj-owner').value, compliance, status: 'Open', location: loc, openedAt: new Date().toISOString(), closesAt: new Date(Date.now() + 30 * 86400000).toISOString(), must: FAMILIES[family].must.map((m) => m[0]), nice: FAMILIES[family].nice.map((m) => m[0]) };
    DB.jobs.unshift(job);
    closeModal(); save();
    ui.jobTab = 'pipeline';
    location.hash = `#/jobs/${id}`;
    toast(`${title} created. New applications will be screened against its checklist`);
  };

  // ---------- outbox message
  const openOutboxMsg = (id) => {
    const m = DB.outbox.find((x) => x.id === id); if (!m) return;
    modalState = { kind: 'outbox', id };
    openModal(`${modalHead(esc(m.channel === 'Email' ? m.subject : `${m.channel} message`), `To ${esc(m.toName)} · ${esc(m.to)} · ${esc(when(m.at))}`)}
      <div class="msg-body"><div class="ob-tags"><span class="badge ${KIND[m.kind] ? KIND[m.kind][1] : ''}">${esc(KIND[m.kind] ? KIND[m.kind][0] : m.kind)}</span>${m.status === 'Draft' ? '<span class="state"><span class="dot amber"></span>Draft · waiting for approval</span>' : `<span class="state"><span class="dot"></span>${esc(m.status)}</span>`}</div>
        ${m.status === 'Draft' ? `<textarea id="ob-text" class="modal-text">${esc(m.body)}</textarea>` : `<div class="ob-body">${esc(m.body)}</div>`}</div>
      <div class="modal-f"><span>${m.candId ? `<button class="link-btn" data-ob-open="${m.candId}">Open candidate</button>` : ''}</span><div class="btns"><button class="btn" data-close-modal>Close</button>${m.status === 'Draft' ? `<button class="btn primary" data-ob-approve="${m.id}">${I.send}Approve & send</button>` : ''}</div></div>`);
  };

  // ================================================================== export
  const exportCsv = (list) => {
    const cell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const head = SAMPLE_MODE ? ['Name', 'Email', 'Phone', 'Job', 'Client', 'Match score', 'Match', 'Experience', 'Location', 'Notice period', 'Right to work', 'Source', 'Owner', 'Stage', 'Applied'] : ['Name', 'Email', 'Role', 'Match score', 'Match', 'Experience', 'Location', 'Stage', 'Applied'];
    const lines = list.map((a) => (SAMPLE_MODE
      ? [a.name, a.email, a.phone, jobOf(a) ? jobOf(a).title : '', clientOf(a) ? clientOf(a).name : '', a.score ?? '', a.tier.label, a.exp, a.loc, a.avail, a.rtw ? a.rtw.label : '', a.source, byName(a.owner), stageLabel(a.decision), day(a.at)]
      : [a.name, a.email, a.role, a.score ?? '', a.tier.label, a.exp, a.loc, stageLabel(a.decision), day(a.at)]).map(cell).join(','));
    const blob = new Blob([[head.map(cell).join(','), ...lines].join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const link = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: `candidates-${new Date().toISOString().slice(0, 10)}.csv` });
    document.body.appendChild(link); link.click(); link.remove();
    toast(`Exported ${list.length} candidates`);
  };

  // ================================================================== render
  const renderAll = () => {
    const r = route();
    renderSide();
    if (r.page === 'dashboard') renderDashboard();
    else if (r.page === 'jobs') renderJobs();
    else if (r.page === 'job') renderJob(r.id);
    else if (r.page === 'pool') renderPool();
    else if (r.page === 'interviews') renderInterviews();
    else if (r.page === 'outbox') renderOutbox();
    else renderApplications();
    renderPanel();
    saveUrl();
  };
  window.addEventListener('hashchange', () => { ui.selected.clear(); if (route().page !== 'job') ui.jobTab = 'pipeline'; renderAll(); $('main').scrollTo(0, 0); });

  // ================================================================== events
  const findPerson = (kind, id) => (kind === 'pool' ? DB.pool : APPS).find((x) => x.id === id);
  document.addEventListener('click', (e) => {
    const t = e.target;
    if (t.closest('#modal')) return; // handled below
    // selection checkboxes
    const cb = t.closest('[data-sel]');
    if (cb) { ui.selected[cb.checked ? 'add' : 'delete'](cb.dataset.sel); renderAll(); return; }
    const all = t.closest('[data-sel-all], [data-sel-all-pool]');
    if (all) {
      const ids = [...document.querySelectorAll('[data-sel]')].map((x) => x.dataset.sel);
      ids.forEach((id) => ui.selected[all.checked ? 'add' : 'delete'](id));
      renderAll(); return;
    }
    if (t.closest('.col-cb')) return;
    // page controls
    const page = t.closest('[data-page]'); if (page) { ui.apps.page += Number(page.dataset.page); renderAll(); $('main').scrollTo({ top: 0, behavior: 'smooth' }); return; }
    const ppage = t.closest('[data-pool-page]'); if (ppage) { ui.pool.page += Number(ppage.dataset.poolPage); renderAll(); return; }
    const opage = t.closest('[data-ob-page]'); if (opage) { ui.outbox.page += Number(opage.dataset.obPage); renderAll(); return; }
    if (t.closest('[data-export]')) { exportCsv(visibleApps()); return; }
    const bulk = t.closest('[data-bulk]');
    if (bulk) {
      const people = [...ui.selected].map((id) => APPS.find((a) => a.id === id)).filter(Boolean);
      const k = bulk.dataset.bulk;
      if (k === 'clear') { ui.selected.clear(); renderAll(); return; }
      if (k === 'export') { exportCsv(people); return; }
      if (k === 'message') { openMessage(people, 'cand'); return; }
      people.forEach((p) => setStage(p, k, { toggle: false, silent: true }));
      ui.selected.clear(); renderAll();
      toast(`${people.length} candidate${people.length === 1 ? '' : 's'} moved to ${stageLabel(k)}${k === 'not_now' && SAMPLE_MODE ? '. Decline emails drafted in Outbox' : ''}`);
      return;
    }
    const pbulk = t.closest('[data-pool-bulk]');
    if (pbulk) {
      const people = [...ui.selected].map((id) => DB.pool.find((p) => p.id === id)).filter(Boolean);
      const k = pbulk.dataset.poolBulk;
      if (k === 'clear') { ui.selected.clear(); renderAll(); return; }
      if (k === 'message') { openMessage(people, 'pool'); ui.selected.clear(); return; }
      if (k === 'add') { const job = JOB(ui.pool.jobId) || JOB(route().id); let n = 0; people.forEach((p) => { if (addFromPool(p, job, { silent: true })) n++; }); ui.selected.clear(); save(); renderAll(); toast(`${n} candidate${n === 1 ? '' : 's'} added to ${job.title}`); return; }
    }
    const addP = t.closest('[data-add-pool]'); if (addP) { addFromPool(DB.pool.find((p) => p.id === addP.dataset.addPool), JOB(addP.dataset.job)); return; }
    const msgP = t.closest('[data-msg-pool]'); if (msgP) { openMessage([DB.pool.find((p) => p.id === msgP.dataset.msgPool)], 'pool'); return; }
    const scan = t.closest('[data-scan]'); if (scan && scan.dataset.scan) { scanPool(scan.dataset.scan); return; }
    const sl = t.closest('[data-shortlist]'); if (sl) { openShortlist(sl.dataset.shortlist); return; }
    if (t.closest('[data-new-job]')) { openNewJob(); return; }
    const jf = t.closest('[data-jobs-filter]'); if (jf) { ui.jobsFilter = jf.dataset.jobsFilter; renderAll(); return; }
    const jt = t.closest('[data-job-tab]'); if (jt) { ui.jobTab = jt.dataset.jobTab; ui.selected.clear(); renderAll(); return; }
    const ot = t.closest('[data-ob-tab]'); if (ot) { ui.outbox.tab = ot.dataset.obTab; ui.outbox.page = 0; renderAll(); return; }
    const auto = t.closest('[data-auto]');
    if (auto) {
      const k = auto.dataset.auto;
      DB.automations[k] = k === 'declines' ? (DB.automations.declines === 'draft' ? 'off' : 'draft') : !DB.automations[k];
      save(); renderAll(); toast('Automation updated'); return;
    }
    if (t.closest('[data-approve-all]')) {
      const drafts = DB.outbox.filter((m) => m.status === 'Draft');
      drafts.forEach((m) => { m.status = 'Sent'; m.at = new Date().toISOString(); const c = APPS.find((x) => x.id === m.candId); if (c) addEvent(c, 'Decline email sent'); });
      save(); renderAll(); toast(`${drafts.length} email${drafts.length === 1 ? '' : 's'} sent`); return;
    }
    const ob = t.closest('[data-ob]'); if (ob) { openOutboxMsg(ob.dataset.ob); return; }
    const href = t.closest('[data-href]'); if (href) { location.hash = href.dataset.href; return; }
    // panel
    if (t.closest('#panel')) {
      const isPool = ui.panel && ui.panel.kind === 'pool';
      const a = ui.panel && findPerson(ui.panel.kind, ui.panel.id);
      const mv = t.closest('[data-move]'); if (mv) { movePanel(Number(mv.dataset.move)); return; }
      if (t.closest('[data-close]')) { closePanel(); return; }
      if (!a) return;
      if (isPool) {
        if (t.closest('[data-add-pool-panel]')) { addFromPool(a, JOB($('pool-add-job').value)); }
        return;
      }
      const m = t.closest('[data-mark]'); if (m) { setStage(a, m.dataset.mark); return; }
      if (t.closest('[data-cv]')) { if (a.cv === 'demo') toast('CV previews are not included in the sample workspace', false); else window.open(a.cv, '_blank', 'noopener'); return; }
      if (t.closest('[data-msg]')) { openMessage([a], 'cand'); return; }
      if (t.closest('[data-schedule]')) { openScheduler(a); return; }
      if (t.closest('[data-draft]')) { openDraft(a); return; }
      if (t.closest('[data-request-docs]')) { requestDocs(a); return; }
      const dr = t.closest('[data-doc-received]');
      if (dr) { const d = a.docs[Number(dr.dataset.docReceived)]; d.state = 'received'; addEvent(a, `${d.name} received`); save(); renderAll(); toast(`${d.name} marked as received`); return; }
      const men = t.closest('[data-mention]'); if (men) { const ta = $('note-text'); ta.value = `${ta.value}${ta.value && !ta.value.endsWith(' ') ? ' ' : ''}@${men.dataset.mention} `; ta.focus(); return; }
      if (t.closest('[data-add-note]')) {
        const text = $('note-text').value.trim(); if (!text) return;
        a.notes = a.notes || []; a.notes.push({ at: new Date().toISOString(), by: ME.id, text });
        const mentioned = DB.team.filter((u) => text.includes(`@${firstOf(u.name)}`)).map((u) => firstOf(u.name));
        save(); renderAll();
        toast(mentioned.length ? `Note added. ${mentioned.join(' and ')} will be notified` : 'Note added');
        return;
      }
      return;
    }
    // open a person from any list
    const open = t.closest('[data-open]');
    if (open) { const [kind, id] = open.dataset.open.split(':'); openPanel(kind, id); }
  });
  $('scrim').addEventListener('click', closePanel);
  document.addEventListener('change', (e) => {
    const t = e.target;
    if (t.matches('[data-f]')) { ui.apps[t.dataset.f] = t.value; ui.apps.page = 0; ui.selected.clear(); renderAll(); return; }
    if (t.matches('[data-pool-job]')) { ui.pool.jobId = t.value; ui.pool.page = 0; ui.selected.clear(); renderAll(); return; }
    if (t.matches('[data-bulk-assign]') && t.value) {
      const u = USER(t.value);
      [...ui.selected].forEach((id) => { const a = APPS.find((x) => x.id === id); if (a) { a.owner = u.id; addEvent(a, `Reassigned to ${u.name}`); } });
      const n = ui.selected.size; ui.selected.clear(); save(); renderAll(); toast(`${n} candidate${n === 1 ? '' : 's'} assigned to ${u.name}`); return;
    }
    if (t.matches('[data-owner]')) {
      const a = APPS.find((x) => x.id === ui.panel.id); const u = USER(t.value);
      a.owner = u.id; addEvent(a, `Reassigned to ${u.name}`); save(); renderAll(); toast(`${a.name} assigned to ${u.name}`);
    }
  });
  let typing;
  document.addEventListener('input', (e) => {
    const t = e.target;
    const run = (fn) => { clearTimeout(typing); typing = setTimeout(() => { fn(); const el = $(t.id); if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); } }, 150); };
    if (t.id === 'q') run(() => { ui.apps.q = t.value.trim(); ui.apps.page = 0; renderAll(); });
    if (t.id === 'pool-q') run(() => { ui.pool.q = t.value.trim(); ui.pool.page = 0; renderAll(); });
    if (t.id === 'ob-q') run(() => { ui.outbox.q = t.value.trim(); ui.outbox.page = 0; renderAll(); });
    if (t.id === 'msg-text' && modalState) modalState.text = t.value;
  });

  // modal clicks
  $('modal').addEventListener('click', async (e) => {
    const t = e.target;
    if (t === $('modal') || t.closest('[data-close-modal]')) { closeModal(); return; }
    const st = modalState; if (!st) return;
    if (t.closest('[data-copy]')) { if (await copyText($('draft').value)) toast('Email copied to the clipboard'); else { $('draft').select(); toast('Press Ctrl+C to copy', false); } return; }
    if (t.closest('[data-draft-save]')) {
      const a = APPS.find((x) => x.id === st.id);
      addOutbox({ channel: 'Email', kind: 'decline', toName: a.name, to: a.email, candId: a.id, jobId: a.jobId, status: 'Draft', subject: `Your application: ${jobOf(a) ? jobOf(a).title : a.role}`, body: $('draft').value.replace(/^Subject:.*\n\n/, '') });
      closeModal(); save(); renderAll(); toast('Decline saved to Outbox for approval'); return;
    }
    // scheduler
    const w = t.closest('[data-sched-with]'); if (w) { const p = w.dataset.schedWith; st.with = st.with.includes(p) ? st.with.filter((x) => x !== p) : [...st.with, p]; renderScheduler(); return; }
    const f = t.closest('[data-sched-format]'); if (f) { st.format = f.dataset.schedFormat; renderScheduler(); return; }
    const du = t.closest('[data-sched-dur]'); if (du) { st.duration = Number(du.dataset.schedDur); renderScheduler(); return; }
    const dy = t.closest('[data-sched-day]'); if (dy) { st.day = Number(dy.dataset.schedDay); st.slot = ''; renderScheduler(); return; }
    const sl = t.closest('[data-sched-slot]'); if (sl && !sl.disabled) { st.slot = sl.dataset.schedSlot; renderScheduler(); return; }
    if (t.closest('[data-sched-send]')) { sendInvite(); return; }
    // messages
    const ch = t.closest('[data-msg-channel]'); if (ch) { st.channel = ch.dataset.msgChannel; renderMessage(); return; }
    const tp = t.closest('[data-msg-tpl]');
    if (tp) {
      const people = st.ids.map((id) => (st.targetKind === 'pool' ? DB.pool : APPS).find((x) => x.id === id));
      const j = JOB(st.jobId); st.tpl = tp.dataset.msgTpl; st.text = TEMPLATES[st.tpl].text(people[0], j, j ? CLIENT(j.clientId) : null); renderMessage(); return;
    }
    if (t.closest('[data-msg-send]')) { sendMessages(); return; }
    // shortlist
    if (t.closest('[data-sl-link]')) { const link = `https://share.harbourline.example/s/${st.jobId.toLowerCase()}-${Date.now().toString(36).slice(-4)}`; await copyText(link); toast('Share link copied. It opens a read-only page for the client'); return; }
    if (t.closest('[data-sl-print]')) { printShortlist(); return; }
    if (t.closest('[data-sl-send]')) { sendShortlist(); return; }
    // new job
    if (t.closest('[data-nj-create]')) { createJob(); return; }
    // outbox
    const ap = t.closest('[data-ob-approve]');
    if (ap) {
      const m = DB.outbox.find((x) => x.id === ap.dataset.obApprove);
      m.body = $('ob-text').value; m.status = 'Sent'; m.at = new Date().toISOString();
      const c = APPS.find((x) => x.id === m.candId); if (c) addEvent(c, `${KIND[m.kind] ? KIND[m.kind][0] : 'Email'} sent`);
      closeModal(); save(); renderAll(); toast(`Email sent to ${m.toName}`); return;
    }
    const oo = t.closest('[data-ob-open]'); if (oo) { const id = oo.dataset.obOpen; closeModal(); location.hash = '#/applications'; setTimeout(() => openPanel('cand', id), 30); }
  });

  // drag and drop on the job pipeline
  document.addEventListener('dragstart', (e) => { const c = e.target.closest && e.target.closest('[data-drag]'); if (c) { e.dataTransfer.setData('text/plain', c.dataset.drag); c.classList.add('dragging'); } });
  document.addEventListener('dragend', (e) => { const c = e.target.closest && e.target.closest('[data-drag]'); if (c) c.classList.remove('dragging'); document.querySelectorAll('.kcol.over').forEach((x) => x.classList.remove('over')); });
  document.addEventListener('dragover', (e) => { const col = e.target.closest && e.target.closest('[data-drop]'); if (col) { e.preventDefault(); document.querySelectorAll('.kcol.over').forEach((x) => x !== col && x.classList.remove('over')); col.classList.add('over'); } });
  document.addEventListener('drop', (e) => { const col = e.target.closest && e.target.closest('[data-drop]'); if (!col) return; e.preventDefault(); const id = e.dataTransfer.getData('text/plain'); setStage(APPS.find((a) => a.id === id), col.dataset.drop, { toggle: false }); });

  // chart tooltips
  document.addEventListener('mousemove', (e) => {
    const tip = $('tip');
    const el = e.target.closest && e.target.closest('[data-tip]');
    if (!el) { tip.classList.add('hide'); return; }
    tip.innerHTML = el.dataset.tip;
    tip.classList.remove('hide');
    const x = Math.min(window.innerWidth - tip.offsetWidth - 12, e.clientX + 14);
    const y = Math.max(8, e.clientY - tip.offsetHeight - 10);
    tip.style.left = `${x}px`; tip.style.top = `${y}px`;
  });

  // keyboard
  document.addEventListener('keydown', (e) => {
    if ($('modal').classList.contains('open')) { if (e.key === 'Escape') closeModal(); return; }
    if (e.target.matches('input, select, textarea') || e.metaKey || e.ctrlKey || e.altKey) { if (e.key === 'Escape') e.target.blur(); return; }
    const k = e.key.toLowerCase();
    if (k === '/') { const q = $('q') || $('pool-q') || $('ob-q'); if (q) { e.preventDefault(); q.focus(); } return; }
    if (!ui.panel) return;
    if (k === 'escape') closePanel();
    else if (k === 'arrowdown' || k === 'j') { e.preventDefault(); movePanel(1); }
    else if (k === 'arrowup' || k === 'k') { e.preventDefault(); movePanel(-1); }
    else if (ui.panel.kind === 'cand') {
      const a = APPS.find((x) => x.id === ui.panel.id);
      if (k === 's') setStage(a, 'shortlisted');
      else if (k === 'i') setStage(a, 'interview');
      else if (k === 'n') setStage(a, 'not_now');
    }
  });

  renderAll();
  const startId = url.searchParams.get('id');
  if (startId && APPS.find((a) => a.id === startId)) openPanel('cand', startId);
  if (S.notice) toast(S.notice);
})();
