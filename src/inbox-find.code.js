// n8n Code node: picks the job applications out of a batch of inbox emails. No AI here:
// plain keyword rules, so nothing leaves this machine. Skips emails already on record.
const settings = settingsFrom(rowsOf('Get settings'));
const roles = rolesFrom(rowsOf('Get roles'));
const known = new Set(rowsOf('Get applications').map((r) => r.message_id));
const emails = $('Read inbox (read-only)').all();

const APPLY_WORDS = /\b(appl(y|ying|ied|ication)|resume|résumé|cv|curriculum vitae|candidate|candidacy|position|vacancy|opening|job|hiring|role|interested in|join your team|available immediately|years? (of )?experience)\b/i;
const NOT_APPLY = /\b(invoice|payment|receipt|order|webinar|newsletter|unsubscribe|verify your|password|security alert|subscription|refer a friend|registered agent|statement|renewal|domain|trial)\b/i;
const NO_REPLY = /(no-?reply|mailer-daemon|notifications?@|postmaster|bounce)/i;
const CV_NAME = /(cv|resume|résumé|curriculum)/i;
const DOC_EXT = /\.(pdf|docx|doc)$/i;
const ownDomain = String(settings.own_domain || '').toLowerCase();

const out = [];
for (const email of emails) {
  const m = email.json || {};
  const id = String(m.messageId || `${m.date}|${m.subject}`);
  if (known.has(id)) continue;
  known.add(id);

  const sender = (m.from && m.from.value && m.from.value[0]) || {};
  const address = String(sender.address || '').toLowerCase();
  const subject = String(m.subject || '');
  const body = String(m.text || '').replace(/\s+/g, ' ').trim();
  const headers = m.headers || {};

  const files = Object.entries(email.binary || {}).filter(([, b]) => DOC_EXT.test(b.fileName || ''));
  const cvNamed = files.filter(([, b]) => CV_NAME.test(b.fileName || ''));
  // Prefer a file called CV/resume; otherwise the largest document attached.
  const size = (b) => Number(String(b.fileSize || '0').replace(/[^\d.]/g, '')) * (/mb/i.test(b.fileSize || '') ? 1000 : 1);
  const cv = (cvNamed[0] || files.sort((a, b) => size(b[1]) - size(a[1]))[0] || null);
  const role = matchRole(roles, subject, body);

  let score = 0;
  const why = [];
  if (APPLY_WORDS.test(subject)) { score += 3; why.push('subject mentions applying'); }
  else if (APPLY_WORDS.test(body.slice(0, 1500))) { score += 1; why.push('body mentions applying'); }
  if (role.source === 'subject') { score += 2; why.push(`subject names a role`); }
  if (cvNamed.length) { score += 3; why.push('CV attached'); } else if (files.length) { score += 1; why.push('document attached'); }
  if (NOT_APPLY.test(subject)) { score -= 4; why.push('looks like a service email'); }
  if (headers['list-unsubscribe']) { score -= 3; why.push('mailing list'); }
  if (NO_REPLY.test(address)) { score -= 4; why.push('automated sender'); }
  if (ownDomain && String(address.split('@')[1] || '').startsWith(ownDomain)) { score -= 5; why.push('our own address'); }
  if (score < 3) continue;

  const ext = cv ? String(cv[1].fileName).split('.').pop().toLowerCase() : '';
  out.push({
    json: {
      message_id: id,
      received_at: m.date ? new Date(m.date).toISOString() : '',
      from_name: String(sender.name || address.split('@')[0] || ''),
      from_email: address,
      subject,
      role: role.role,
      role_source: role.source,
      detect_reason: why.join(', '),
      cover_text: body.slice(0, 1500),
      cv_original_name: cv ? String(cv[1].fileName) : '',
      cv_ext: ext,
    },
    binary: cv ? { cv: cv[1] } : undefined,
  });
}
return out;
