// POST /webhook/umbrella/evidence: check each payslip line against what the agency knows.
// Rules (flags are for human review, not compliance decisions):
//  R1 hours on the payslip match approved timesheet hours for the period
//  R2 assignment income matches approved hours x the assignment rate the agency paid (within £1)
//  R3 taxable gross pay per hour is at least the National Living Wage
//  R4 any non-taxable payment is flagged for review
// Returns { evidenceUpdates, checkInserts, messages, html }.
const config = configFrom('Config');
const form = $('Webhook').first().json.body || {};
const token = String(form.t || '');
const ev = tableRows('Evidence').find((e) => token && e.upload_token === token);
const agency = config.agency_name;
const fail = (title, msg) => [{ json: { evidenceUpdates: [], checkInserts: [], messages: [], html: page(title, agency, `<h1>${esc(title)}</h1><div class="warn">${esc(msg)}</div>`) } }];
if (!ev) return fail('Link not valid', `Please contact ${config.compliance_email}.`);
if (ev.status !== 'requested') return fail('Already received', 'Evidence for this period has already been uploaded.');

const umbrella = tableRows('Umbrellas').find((u) => u.umbrella_id === ev.umbrella_id);
const T = Object.fromEntries(tableRows('Temps').map((t) => [t.temp_id, t]));
const nlw = Number(config.national_living_wage);
const sheets = tableRows('Timesheets').filter((t) => String(t.week_ending).slice(0, 7) === ev.period && ['approved', 'exported'].includes(t.status));
const lines = $('Read CSV').all().map((i) => i.json).filter((r) => r.temp_id);
if (!lines.length) return fail('Could not read the file', 'Please upload the CSV with the column headings shown on the previous page.');

const checkInserts = [];
for (const line of lines) {
  const temp = T[String(line.temp_id).trim()];
  const hours = Number(line.hours);
  const income = Number(line.assignment_income);
  const gross = Number(line.gross_taxable_pay);
  const nonTax = Number(line.non_taxable_payments || 0);
  const reasons = [];
  let approvedHours = 0;
  let expected = 0;
  if (!temp || temp.pay_route !== ev.umbrella_id) {
    reasons.push('Worker is not on assignment through this umbrella');
  } else {
    approvedHours = round2(sheets.filter((s) => s.temp_id === temp.temp_id).reduce((s, t) => s + Number(t.hours), 0));
    expected = round2(approvedHours * temp.pay_rate);
    if (Math.abs(hours - approvedHours) > 0.01) reasons.push(`Hours ${hours} vs ${approvedHours} approved`);
    if (Math.abs(income - expected) > 1) reasons.push(`Assignment income ${money(income)} vs ${money(expected)} paid by us (${income < expected ? '-' : '+'}${money(Math.abs(income - expected))})`);
  }
  const perHour = hours > 0 ? round2(gross / hours) : 0;
  if (hours > 0 && perHour < nlw) reasons.push(`Taxable pay ${money(perHour)}/hr is below the ${money(nlw)} National Living Wage`);
  if (nonTax > 0) reasons.push(`Non-taxable payment of ${money(nonTax)}: ask what it is`);
  checkInserts.push({
    evidence_id: ev.evidence_id, umbrella_id: ev.umbrella_id, period: ev.period, temp_id: String(line.temp_id).trim(),
    worker_name: temp ? fullName(temp) : String(line.worker_name || line.temp_id), hours, approved_hours: approvedHours,
    expected_income: expected, assignment_income: round2(income), gross_taxable_pay: round2(gross), gross_per_hour: perHour,
    non_taxable_payments: round2(nonTax), result: reasons.length ? 'Flag' : 'OK', reasons: reasons.join('; '), checked_at: nowIso(),
  });
}

const flags = checkInserts.filter((c) => c.result === 'Flag');
const status = flags.length ? 'flagged' : 'ok';
const evidenceUpdates = [{ id: ev.id, status, received_at: nowIso(), file_name: `${ev.evidence_id}.csv`, lines: checkInserts.length, flags: flags.length }];
const messages = [{
  channel: 'Email', to_name: 'Compliance', to_address: config.compliance_email,
  subject: flags.length ? `Review needed: ${flags.length} payslip flag${flags.length > 1 ? 's' : ''} from ${umbrella.name} (${ev.period})` : `${umbrella.name} ${ev.period}: all ${checkInserts.length} payslips match`,
  body: flags.length ? flags.map((f) => `${f.worker_name}: ${f.reasons}`).join(' | ') + '. Flags are prompts for review, not findings.' : 'Hours, assignment income, NLW and non-taxable checks all passed. Evidence filed for audit.',
  link: `${config.base_url}/webhook/console`, related: ev.evidence_id, workflow: 'Umbrella evidence check',
}];
const html = page('Evidence received', agency, `<h1>Thank you, ${esc(umbrella.name)}</h1><div class="ok">We received ${checkInserts.length} payslip line${checkInserts.length > 1 ? 's' : ''} for ${esc(ev.period)}.</div><p class="muted">${esc(agency)}'s compliance team will contact you if anything needs clarifying.</p>`);
// Keep the umbrella's original file for the audit trail.
const original = $('Webhook').first().binary?.file;
return [{
  json: { evidenceUpdates, checkInserts, messages, html, savePath: original ? `umbrella-evidence/${ev.evidence_id}-${Date.now()}.csv` : '' },
  ...(original ? { binary: { data: original } } : {}),
}];
