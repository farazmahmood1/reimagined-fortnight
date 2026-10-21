// POST /webhook/register/verify: the admin marks an uploaded renewal verified (the register takes its new expiry date),
// or sends it back with a reason. Returns { updates, messages, audit, location }.
const cfg = configFrom();
const body = $('Webhook').first().json.body || {};
const tab = String(body.tab || 'consents');
const r = tableRows('Register').find((x) => x.reg_id === String(body.id || ''));
const none = { updates: [], messages: [], audit: [] };
const done = (notice, extra = {}) => [{ json: { ...none, ...extra, location: backToConsole(cfg, tab, notice) } }];
if (!r || r.status !== 'received') return done('Nothing to check for that record: it is not waiting for verification.');
const action = String(body.action || '');
const admin = person(cfg, 'admin');

if (action === 'back') {
  const reason = String(body.reason || '').trim().slice(0, 300);
  if (reason.length < 5) return done('Say what is wrong, so they know what to fix.');
  const who = { name: r.responsible_name, email: r.responsible_email, phone: r.responsible_phone };
  const link = `${cfg.base_url}/webhook/register/upload?t=${r.upload_token}`;
  return done(`Sent back to ${r.responsible_name}: ${r.type}.`, {
    updates: [{ id: r.id, status: 'requested', new_expiry: '', file_name: '', original_name: '', received_at: '', note: reason, last_reminder_at: nowIso() }],
    messages: reach(who, {
      subject: `Please upload again: ${r.type}`,
      body: `Kia ora ${firstName(who.name)},\n\n${admin.name} checked what you sent for your ${r.type.toLowerCase()} and needs a different one.\nReason: ${reason}\n\nPlease upload it again from the secure link. This message is automated.`,
      sms: `Kia ora ${firstName(who.name)}, ${admin.name} needs a different file for your ${r.type.toLowerCase()}: ${reason} Upload again here:`,
      link, related: r.reg_id, workflow: 'Certificate sent back',
    }),
    audit: [auditRow(admin.name, 'person', 'Consents', `${r.type}, ${r.responsible_name}`, 'Sent back the upload', `Reason: ${reason}`)],
  });
}
if (action !== 'verify') return done('Choose Mark verified or Send back.');

const renewed = { ...r, status: 'verified', expiry_date: r.new_expiry || r.expiry_date, renewal_lodged_at: '' };
const st = registerState(renewed, cfg, nzToday());
return done(`Verified: ${r.type}, ${r.responsible_name}. It now runs to ${fmtDate(renewed.expiry_date)}.`, {
  updates: [{ id: r.id, status: 'verified', expiry_date: renewed.expiry_date, new_expiry: '', verified_at: nowIso(), verified_by: admin.name, renewal_lodged_at: '', reminders_sent: 0, last_reminder_at: '', last_state: st.state, note: '' }],
  audit: [auditRow(admin.name, 'person', 'Consents', `${r.type}, ${r.responsible_name}`, 'Verified the renewal', `New expiry ${fmtDate(renewed.expiry_date)} (was ${fmtDate(r.expiry_date)}). The register is up to date and reminders stop.`)],
});
