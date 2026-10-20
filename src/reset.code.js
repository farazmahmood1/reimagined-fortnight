// Builds the Monday-morning starting point for the demo. DEMO_DATA is injected by the build script
// from scripts/demo-data.mjs. All dates are worked out from today, so every reset tells the same story:
// last week's timesheets are due, one right to work expires in 14 days, one licence expired 12 days ago,
// and last month's umbrella evidence is due. Returns one item with an array of rows per data table.
const D = DEMO_DATA;
const now = nowIso();
const DAY = 86400000;
const iso = (d) => d.toISOString().slice(0, 10);
const today = new Date(`${iso(new Date())}T00:00:00Z`);

// Last completed week: the most recent Sunday before today.
const back = today.getUTCDay() === 0 ? 7 : today.getUTCDay();
const weekEnding = iso(new Date(today.getTime() - back * DAY));
// Evidence period: the calendar month before that week's month (never overlaps "last week").
const we = new Date(`${weekEnding}T00:00:00Z`);
const periodStart = new Date(Date.UTC(we.getUTCFullYear(), we.getUTCMonth() - 1, 1));
const period = iso(periodStart).slice(0, 7);
const monthWeeks = [];
for (let d = new Date(periodStart); d.getUTCMonth() === periodStart.getUTCMonth(); d = new Date(d.getTime() + DAY)) {
  if (d.getUTCDay() === 0) monthWeeks.push(iso(d));
}
const lastMonthWeeks = monthWeeks.slice(0, 4);

const config = [...D.CONFIG, { key: 'week_ending', value: weekEnding }, { key: 'evidence_period', value: period }];
const temps = D.TEMPS.map((t) => ({ ...t, compliance_status: '', compliance_checked_at: '' }));
const T = Object.fromEntries(temps.map((t) => [t.temp_id, t]));

const timesheets = [];
D.TIMESHEETS_THIS_WEEK.forEach((s) => {
  const t = T[s.temp_id];
  const submitted = s.status !== 'missing';
  timesheets.push({
    timesheet_id: `TS-${weekEnding}-${s.temp_id}`, week_ending: weekEnding, temp_id: s.temp_id, client_id: t.client_id,
    hours: s.hours || 0, daily_breakdown: submitted ? 'Mon–Fri' : '', notes: '', status: s.status,
    submit_token: newToken(), approve_token: submitted ? newToken() : '',
    submitted_at: submitted ? now : '', approved_at: s.status === 'approved' ? now : '', approved_by: s.status === 'approved' ? 'Client manager' : '',
    reminders_sent: 0, last_reminder_at: '', exported_at: '', export_file: '', queried_at: '',
  });
});
Object.entries(D.LAST_MONTH_HOURS).forEach(([tempId, weeks]) => {
  weeks.forEach((h, i) => {
    const week = lastMonthWeeks[i];
    if (!week) return;
    timesheets.push({
      timesheet_id: `TS-${week}-${tempId}`, week_ending: week, temp_id: tempId, client_id: T[tempId].client_id, hours: h,
      daily_breakdown: 'Mon–Fri', notes: '', status: 'exported', submit_token: newToken(), approve_token: newToken(),
      submitted_at: `${week}T18:00:00.000Z`, approved_at: `${week}T20:00:00.000Z`, approved_by: 'Client manager',
      reminders_sent: 0, last_reminder_at: '', exported_at: `${week}T22:00:00.000Z`, export_file: `payroll-we-${week}.csv`, queried_at: '',
    });
  });
});

const documents = D.DOCUMENTS.map((d, i) => ({
  doc_id: `D${String(i + 1).padStart(3, '0')}`, temp_id: d.temp_id, doc_type: d.doc_type, status: d.status,
  expiry_date: d.expires_in_days === null ? '' : iso(new Date(today.getTime() + d.expires_in_days * DAY)),
  upload_token: newToken(), file_name: '', original_name: '', received_at: d.status === 'missing' ? '' : now, reminders_sent: 0, last_reminder_at: '',
}));

return [{ json: {
  Config: config, Clients: D.CLIENTS, Umbrellas: D.UMBRELLAS, Temps: temps, Timesheets: timesheets, Documents: documents,
  summary: `Demo data reset: week ending ${weekEnding}, umbrella evidence for ${period}.`,
} }];
