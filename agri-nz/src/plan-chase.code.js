// "Chase farm plan evidence": asks the person who holds each missing item for it, reminds after a week, and stops at
// three requests so a person can phone instead. Never messages the same person about the same item twice in 24 hours.
// Returns { updates, messages, audit, summary }.
const cfg = configFrom();
const base = cfg.base_url;
const farms = Object.fromEntries(tableRows('Farms').map((f) => [f.farm_id, f]));
const items = tableRows('Evidence');
const nowMs = Date.now();
const remindMs = Number(cfg.reminder_days || 7) * DAY_MS;
const maxRequests = Number(cfg.max_requests || 3);
const lastMs = (it) => (it.last_request_at ? new Date(it.last_request_at).getTime() : 0);

const updates = [];
const messages = [];
const audit = [];
const asked = {};      // farm_id → lines for that farm's manager
const phone = {};      // farm_id → items nobody has answered after the maximum number of requests
const toCheck = {};    // farm_id → uploads waiting for the manager to check
let firstRequests = 0;
let reminders = 0;
const push = (map, farm, line) => { (map[farm.farm_id] ||= []).push(line); };

for (const it of items) {
  const farm = farms[it.farm_id];
  if (!farm) continue;
  if (it.status === 'received') { push(toCheck, farm, `${it.requirement} (from ${it.provider_name})`); continue; }
  if (it.status !== 'missing' && it.status !== 'requested') continue;
  const requests = Number(it.requests_sent || 0);
  const due = it.status === 'missing' || !it.last_request_at || nowMs - lastMs(it) >= remindMs;
  if (!due) continue;
  if (nowMs - lastMs(it) < DAY_MS) continue;
  if (requests >= maxRequests) { push(phone, farm, `${it.requirement} (${it.provider_name}, asked ${requests} times)`); continue; }

  const link = `${base}/webhook/farmplan/upload?t=${it.upload_token}`;
  const provider = { name: it.provider_name, email: it.provider_email, phone: it.provider_phone };
  const first = requests === 0;
  const lead = `Kia ora ${firstName(provider.name)}, this is the ${cfg.business_name} farm admin assistant (automated).`;
  messages.push(...reach(provider, {
    subject: `${farm.name} farm plan: ${it.requirement}`,
    body: `${lead}\n\n${first ? 'For' : `A reminder (request ${requests + 1}). For`} the ${farm.name} farm plan we ${first ? 'need' : 'still need'}: ${it.requirement}.\n\nThe certified plan is due by ${fmtDate(cfg.plan_deadline)}, so the sooner the better. You can upload a PDF or a photo from your phone, no login needed.\n\nQuestions? Reply to ${cfg.admin_name} at ${cfg.admin_email}.`,
    sms: `${lead} For the ${farm.name} farm plan we ${first ? 'need' : 'still need'}: ${it.requirement}. Upload a PDF or photo here:`,
    link, related: it.item_id, workflow: first ? 'Evidence request' : 'Evidence reminder',
  }));
  updates.push({ id: it.id, status: 'requested', requests_sent: requests + 1, last_request_at: nowIso() });
  audit.push(auditRow('Agent', 'agent', 'Farm plan', farm.name, `${first ? 'Requested' : `Reminded (request ${requests + 1})`}: ${it.requirement}`, `Asked ${provider.name} by ${provider.phone ? 'SMS' : 'email'}. They upload from a secure link.`));
  if (first) firstRequests++; else reminders++;
  push(asked, farm, `${it.requirement} (${provider.name})`);
}

// One short summary per farm manager, only when there is something to say.
for (const farm of Object.values(farms)) {
  const lines = [];
  if (toCheck[farm.farm_id]) lines.push(`Waiting for you to check:\n${toCheck[farm.farm_id].map((l) => `- ${l}`).join('\n')}`);
  if (asked[farm.farm_id]) lines.push(`Asked this time:\n${asked[farm.farm_id].map((l) => `- ${l}`).join('\n')}`);
  if (phone[farm.farm_id]) lines.push(`No reply, so please phone:\n${phone[farm.farm_id].map((l) => `- ${l}`).join('\n')}`);
  if (!lines.length) continue;
  const c = evidenceCounts(farmItems(farm, items));
  messages.push(msg({
    channel: 'Email', to_name: farm.manager_name, to_address: farm.manager_email, link: `${base}/webhook/console?tab=plan`, related: farm.farm_id, workflow: 'Farm plan summary',
    subject: `${farm.name} farm plan: ${c.verified} of ${c.total} evidence items verified`,
    body: `Kia ora ${firstName(farm.manager_name)},\n\n${lines.join('\n\n')}\n\nNothing is sent to the certifier until the owner signs the pack off. This message is automated.`,
  }));
  audit.push(auditRow('Agent', 'agent', 'Farm plan', farm.name, `Sent ${farm.manager_name} the weekly summary`, `${c.verified} of ${c.total} verified.`));
}

const total = firstRequests + reminders;
const waiting = Object.values(toCheck).reduce((n, l) => n + l.length, 0);
const callNeeded = Object.values(phone).reduce((n, l) => n + l.length, 0);
const summary = total
  ? `Chased ${total} item${total === 1 ? '' : 's'}: ${firstRequests} new request${firstRequests === 1 ? '' : 's'} and ${reminders} reminder${reminders === 1 ? '' : 's'}.${callNeeded ? ` ${callNeeded} need a phone call.` : ''}${waiting ? ` ${waiting} upload${waiting === 1 ? ' is' : 's are'} waiting for a person to check.` : ''}`
  : `Nothing to chase right now.${callNeeded ? ` ${callNeeded} need a phone call.` : ''}${waiting ? ` ${waiting} upload${waiting === 1 ? ' is' : 's are'} waiting for a person to check.` : ''}`;
return [{ json: { updates, messages, audit, summary } }];
