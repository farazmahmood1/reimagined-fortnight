// How the agent reads a consent, certificate or other record that expires. Injected into the nodes that watch or show the register.
//
// Consents follow the renewal rule in section 124 of the Resource Management Act: lodge a renewal at least 6 months before
// expiry and you may keep operating until the council decides; lodge 3 to 6 months before and the council decides whether you
// may; lodge later and you must stop when the consent expires. The months are settings because the rules are being changed.
// Certificates, vehicle fitness and insurance use simple 30-day and 7-day warnings.
const REG_RANK = { expired: 0, late: 1, urgent: 2, missing: 3, lodge: 4, soon: 5, plan: 6, lodged: 7, ok: 8 };
// How many days to leave between reminders to the person responsible, by state.
const REG_CADENCE = { expired: 7, missing: 7, urgent: 3, soon: 14, late: 3, lodge: 7, plan: 30 };
const regNeedsAction = (state) => ['expired', 'late', 'urgent', 'missing', 'lodge', 'soon', 'plan'].includes(state);

// What to tell the person who holds the record. The "do not assign" prompt is for the manager, not for them.
const selfText = (r, st) => {
  if (r.kind === 'Consent') return st.detail;
  const what = r.type.toLowerCase();
  if (st.state === 'expired') return `Your ${what} expired ${-st.left} day${st.left === -1 ? '' : 's'} ago (${fmtDate(r.expiry_date)}).`;
  if (st.state === 'missing') return `We have no record of your ${what} on file.`;
  if (r.expiry_date) return `Your ${what} expires on ${fmtDate(r.expiry_date)} (${st.left} day${st.left === 1 ? '' : 's'}).`;
  return st.detail;
};

const registerState = (r, cfg, today) => {
  const restriction = r.restriction || '';
  const stop = restriction ? ` Do not assign ${restriction} until it is sorted.` : '';
  if (r.status === 'missing' && !r.expiry_date) {
    return { state: 'missing', tone: 'warn', label: 'No evidence on file', detail: `Nothing on file yet.${stop}`, left: null };
  }
  const exp = r.expiry_date;
  if (!exp) return { state: 'ok', tone: 'ok', label: 'Current', detail: 'No expiry date.', left: null };
  const left = daysBetween(today, exp);
  const soonDays = Number(cfg.cert_soon_days || 30);
  const urgentDays = Number(cfg.cert_urgent_days || 7);

  if (r.kind === 'Consent') {
    const lodgeBy = addMonths(exp, -Number(cfg.consent_lodge_months || 6));
    const cutoff = addMonths(exp, -Number(cfg.consent_cutoff_months || 3));
    const planFrom = addMonths(exp, -Number(cfg.consent_plan_months || 8));
    if (r.renewal_lodged_at) {
      const when = String(r.renewal_lodged_at).slice(0, 10);
      const rule = when <= lodgeBy ? 'at least 6 months before it expires, so you may keep operating until the council decides'
        : when <= cutoff ? 'between 3 and 6 months before it expires, so keeping on operating is at the council\'s discretion: get its agreement in writing'
          : 'less than 3 months before it expires, so you must stop when it expires unless it is decided first';
      if (left < 0 && when > lodgeBy) return { state: 'expired', tone: 'bad', label: 'Expired', detail: `Expired ${-left} days ago (${fmtDate(exp)}). The renewal was lodged ${fmtDate(when)}, ${rule}.${stop}`, left };
      return { state: 'lodged', tone: 'info', label: 'Renewal lodged', detail: `Renewal lodged ${fmtDate(when)}, ${rule}.`, left };
    }
    if (left < 0) return { state: 'expired', tone: 'bad', label: 'Expired', detail: `Expired ${-left} days ago (${fmtDate(exp)}).${stop}`, left };
    if (today > cutoff) return { state: 'late', tone: 'bad', label: 'Past the cut-off', detail: `Less than ${cfg.consent_cutoff_months || 3} months left and no renewal lodged. Unless it is renewed first, you must stop ${restriction || 'the activity'} when it expires on ${fmtDate(exp)}. Call your consultant today.`, left };
    if (today > lodgeBy) return { state: 'lodge', tone: 'warn', label: 'Lodge the renewal now', detail: `The ${cfg.consent_lodge_months || 6}-month date (${fmtDate(lodgeBy)}) has passed, so the council now decides whether you may keep operating while it processes a renewal. Lodge by ${fmtDate(cutoff)} at the latest.`, left };
    if (today >= planFrom) return { state: 'plan', tone: 'warn', label: 'Plan the renewal', detail: `Lodge the renewal by ${fmtDate(lodgeBy)} (${cfg.consent_lodge_months || 6} months before expiry) to keep operating as of right while the council decides.`, left };
    return { state: 'ok', tone: 'ok', label: 'Current', detail: `Expires ${fmtDate(exp)}. Lodge a renewal by ${fmtDate(lodgeBy)}.`, left };
  }

  if (left < 0) return { state: 'expired', tone: 'bad', label: 'Expired', detail: `Expired ${-left} days ago (${fmtDate(exp)}).${stop}`, left };
  if (left <= urgentDays) return { state: 'urgent', tone: 'bad', label: `Expires in ${left} day${left === 1 ? '' : 's'}`, detail: `Expires ${fmtDate(exp)}.`, left };
  if (left <= soonDays) return { state: 'soon', tone: 'warn', label: `Expires in ${left} days`, detail: `Expires ${fmtDate(exp)}.`, left };
  return { state: 'ok', tone: 'ok', label: 'Current', detail: `Expires ${fmtDate(exp)}.`, left };
};
