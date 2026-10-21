// "Consents and certificates watch": works out where every record stands, reminds the person responsible on a schedule
// that tightens as the date nears, and tells the admin and the operations manager what needs action.
// It never changes a certificate or consent record itself. Returns { updates, messages, audit, summary }.
const cfg = configFrom();
const base = cfg.base_url;
const today = nzToday();
const nowMs = Date.now();
const rows = tableRows('Register');
const farms = Object.fromEntries(tableRows('Farms').map((f) => [f.farm_id, f]));
const updates = [];
const messages = [];
const audit = [];
const states = [];
const toVerify = [];
let reminded = 0;

for (const r of rows) {
  const st = registerState(r, cfg, today);
  states.push({ r, st });
  const upd = { id: r.id };
  const changed = r.last_state !== st.state && (st.state !== 'ok' || !!r.last_state);
  if (r.last_state !== st.state) upd.last_state = st.state;
  let remindedNow = false;
  if (r.status === 'received') { toVerify.push(r); }
  else if (regNeedsAction(st.state)) {
    const last = r.last_reminder_at ? new Date(r.last_reminder_at).getTime() : 0;
    const due = !last || nowMs - last >= REG_CADENCE[st.state] * DAY_MS;
    if (due && nowMs - last >= DAY_MS) {
      const who = { name: r.responsible_name, email: r.responsible_email, phone: r.responsible_phone };
      const link = `${base}/webhook/register/upload?t=${r.upload_token}`;
      const lead = `Kia ora ${firstName(who.name)}, this is the ${cfg.business_name} farm admin assistant (automated).`;
      const what = r.kind === 'Consent' && r.reference ? `${r.type} (${r.reference})` : r.type;
      const ask = r.kind === 'Consent' ? 'Upload the renewed consent here once it is granted:' : st.state === 'missing' ? 'Please upload your certificate here:' : 'Please upload the renewal here:';
      messages.push(...reach(who, {
        subject: `${what}: ${st.label.toLowerCase()}`,
        body: `${lead}\n\n${r.kind === 'Consent' ? `${what}: ` : ''}${selfText(r, st)}\n\n${ask} ${link}`,
        sms: `${lead} ${what}: ${st.label.toLowerCase()}. ${ask}`,
        link, related: r.reg_id, workflow: 'Expiry reminder',
      }, r.kind === 'Consent' ? 'both' : 'auto'));
      updates.push({ id: r.id, last_reminder_at: nowIso(), reminders_sent: Number(r.reminders_sent || 0) + 1, ...(upd.last_state ? { last_state: upd.last_state } : {}) });
      audit.push(auditRow('Agent', 'agent', 'Consents', `${r.type}, ${r.responsible_name}`, `Reminded: ${st.label}`, `${st.detail} Sent to ${who.name} by ${who.phone ? 'SMS' : 'email'}${r.kind === 'Consent' ? ' and email' : ''}.`));
      reminded++;
      remindedNow = true;
    }
  }
  if (changed && !remindedNow) audit.push(auditRow('Agent', 'agent', 'Consents', `${r.type}, ${r.responsible_name}`, `Status: ${st.label}`, st.detail));
  if (!remindedNow && Object.keys(upd).length > 1) updates.push(upd);
}

// One summary for the admin, and a "do not assign" alert for the operations manager.
const attention = states.filter((x) => regNeedsAction(x.st.state)).sort((a, b) => REG_RANK[a.st.state] - REG_RANK[b.st.state]);
const lastSummary = tableRows('Outbox').filter((m) => m.workflow === 'Register summary').map((m) => m.created_at).sort().pop();
const summaryRecent = lastSummary && nowMs - new Date(lastSummary).getTime() < 12 * 3600 * 1000;
const label = (x) => `${x.r.type}${x.r.reference && x.r.kind !== 'Certificate' ? ` (${x.r.reference})` : ''}, ${x.r.responsible_name}`;
if ((attention.length || toVerify.length) && !summaryRecent) {
  const admin = person(cfg, 'admin');
  messages.push(msg({
    channel: 'Email', to_name: admin.name, to_address: admin.email, link: `${base}/webhook/console?tab=consents`, related: 'Register', workflow: 'Register summary',
    subject: `Consents and certificates: ${attention.length} need action${toVerify.length ? `, ${toVerify.length} to verify` : ''}`,
    body: [`Kia ora ${firstName(admin.name)},`, '',
      attention.length ? `Needs action:\n${attention.map((x) => `- ${label(x)}: ${x.st.label}. ${x.st.detail}`).join('\n')}` : '',
      toVerify.length ? `\nUploaded, waiting for you to verify:\n${toVerify.map((r) => `- ${r.type}, ${r.responsible_name}`).join('\n')}` : '',
      '', 'This message is automated.'].filter((x) => x !== '').join('\n'),
  }));
  audit.push(auditRow('Agent', 'agent', 'Consents', 'Register', `Sent ${admin.name} the summary`, `${attention.length} need action, ${toVerify.length} to verify.`));
  const blocked = attention.filter((x) => x.r.restriction && ['expired', 'missing', 'late', 'urgent'].includes(x.st.state));
  if (blocked.length) {
    const mgr = person(cfg, 'manager');
    messages.push(...reach(mgr, {
      subject: `Do not assign: ${blocked.length} restriction${blocked.length === 1 ? '' : 's'}`,
      body: `Kia ora ${firstName(mgr.name)},\n\nUntil these are sorted, do not assign:\n${blocked.map((x) => `- ${x.r.restriction}: ${x.r.responsible_name}'s ${x.r.type.toLowerCase()} is ${x.st.state === 'missing' ? 'not on file' : x.st.state === 'expired' ? 'expired' : 'about to expire'}`).join('\n')}\n\nThis is a prompt for you to check, not a ruling. This message is automated.`,
      sms: `Do not assign until sorted: ${blocked.map((x) => `${x.r.restriction} (${x.r.responsible_name})`).join('; ')}. Details are in your email.`,
      link: `${base}/webhook/console?tab=consents`, related: 'Register', workflow: 'Do not assign',
    }, 'both'));
    audit.push(auditRow('Agent', 'agent', 'Consents', 'Register', `Told ${mgr.name} what not to assign`, blocked.map((x) => `${x.r.restriction}: ${x.r.responsible_name}`).join('; ')));
  }
}

const count = (...s) => states.filter((x) => s.includes(x.st.state)).length;
const parts = [];
if (count('expired')) parts.push(`${count('expired')} expired`);
if (count('late', 'urgent', 'soon')) parts.push(`${count('late', 'urgent', 'soon')} expiring soon`);
if (count('lodge', 'plan')) parts.push(`${count('lodge', 'plan')} consent renewal${count('lodge', 'plan') === 1 ? '' : 's'} to plan`);
if (count('missing')) parts.push(`${count('missing')} with no evidence`);
return [{ json: { updates, messages, audit, summary: `Checked ${rows.length} records: ${parts.join(', ') || 'all current'}. Sent ${reminded} reminder${reminded === 1 ? '' : 's'}.` } }];
