// Sample workspace for recordings (?demo=1): a fictional UK agency, "Harbourline Recruitment", with
// clients, jobs, applicants, a talent pool, interviews and an outbox, all generated in the browser
// with pre-written AI results. No real people and no API calls. The same seed always gives the same
// workspace, so takes are repeatable; the app shifts saved dates forward so "3 h ago" stays fresh.

// Requirement checklists per role family: [item, [evidence quotes when met]].
const FAMILIES = {
  'Automation Test Engineer': {
    titles: ['QA Automation Engineer', 'SDET', 'Test Automation Engineer', 'Senior Automation Engineer'],
    domains: ['in fintech', 'in e-commerce', 'at SaaS companies', 'in insurance software', 'in logistics software'],
    skills: ['Selenium', 'Playwright', 'Cypress', 'Java', 'TypeScript', 'Python', 'Rest Assured', 'Postman', 'Jenkins', 'GitHub Actions', 'Cucumber', 'Appium', 'JMeter', 'TestNG'],
    must: [
      ['3+ years of test automation on web applications', ['5 years automating web apps at a fintech', '4 years of UI automation for a SaaS product', '3.5 years building regression suites']],
      ['Builds or maintains a framework with Selenium, Playwright or Cypress', ['Built a Playwright framework from scratch', 'Maintains a Selenium + TestNG framework (1,200 tests)', 'Migrated a Cypress suite to Playwright']],
      ['Writes automation code in Java, JavaScript/TypeScript or Python', ['Java 17 page-object model', 'TypeScript test utilities and fixtures', 'Python pytest framework']],
      ['API testing or automation (Postman, Rest Assured or similar)', ['Rest Assured suite covering 180 endpoints', 'Postman + Newman in CI', 'API contract tests with Pact']],
      ['Runs tests in CI/CD and uses Git', ['Nightly runs on GitHub Actions', 'Jenkins pipelines with parallel runs', 'GitLab CI with a Docker grid']],
    ],
    nice: [
      ['BDD with Cucumber or similar', ['Cucumber feature files written with the product team']],
      ['Mobile automation (Appium)', ['Appium tests for Android and iOS apps']],
      ['Performance testing (JMeter, k6)', ['k6 load tests before each release', 'JMeter tests for the checkout flow']],
    ],
    highlights: ['Cut regression time from 2 days to 3 hours by parallelising the suite.', 'Introduced flaky-test tracking that halved false failures.', 'Owns release sign-off for a team of 12 developers.', 'Set up visual regression checks for the design system.'],
  },
  'QA Engineer / SDET': {
    titles: ['QA Engineer', 'Software QA Engineer', 'QA Analyst', 'Senior QA Engineer'],
    domains: ['in mobile banking', 'in telecoms', 'in edtech', 'in retail apps', 'at SaaS companies'],
    skills: ['Manual testing', 'Test cases', 'Jira', 'Postman', 'SQL', 'Selenium', 'Regression testing', 'Agile', 'TestRail', 'Cypress', 'Charles Proxy', 'ISTQB'],
    must: [
      ['2+ years of QA on web or mobile applications', ['3 years testing web and mobile apps', '2.5 years of QA on a banking app', '4 years in a SaaS QA team']],
      ['Writes test cases and clear bug reports', ['Wrote 600+ test cases in TestRail', 'Bug reports with steps, logs and video']],
      ['Tracks bugs in Jira or a similar tool', ['Jira bug triage with product owners', 'Azure DevOps boards for defects']],
      ['Some test automation (Selenium, Playwright, Cypress or similar)', ['Automated smoke tests in Cypress', 'Selenium scripts for regression']],
      ['API testing with Postman or similar', ['Postman collections for core APIs', 'API checks with Postman and Swagger']],
    ],
    nice: [
      ['ISTQB certification', ['ISTQB Foundation Level (2024)']],
      ['Database / SQL testing', ['SQL queries to verify data migrations']],
      ['Experience in Agile teams', ['Two-week sprints with daily stand-ups']],
    ],
    highlights: ['Caught a payment rounding bug before a major release.', 'Built the team\'s first regression checklist.', 'Tests across 30+ device and browser combinations.', 'Works closely with developers in sprint planning.'],
  },
  'Project Operations Manager': {
    titles: ['Project Manager', 'Operations Manager', 'Delivery Manager', 'Senior Project Manager'],
    domains: ['at a software agency', 'at a digital agency', 'in IT services', 'at a product studio', 'in logistics operations'],
    skills: ['Jira', 'ClickUp', 'Agile', 'Scrum', 'Client management', 'Resource planning', 'Budgeting', 'Risk management', 'Asana', 'Confluence', 'PMP', 'Hiring'],
    must: [
      ['4+ years running projects or operations in a software, IT services or digital business', ['6 years at a 120-person software agency', '5 years running delivery at an IT services firm', '4 years as a PM in a digital agency']],
      ['Day-to-day communication with clients or senior stakeholders', ['Account lead for 8 UK and US clients', 'Weekly steering calls with client directors']],
      ['Hands-on use of a project tool such as Jira, ClickUp, Asana or Trello', ['Jira and Confluence admin for 4 teams', 'Runs all delivery in ClickUp']],
      ['Planning and coordinating work across several teams', ['Coordinates 25 developers, designers and QA', 'Resource plans across 6 parallel projects']],
      ['Clear written and spoken English', ['Writes client status reports and SOWs', 'Presents monthly to the board']],
    ],
    nice: [
      ['PMP, PRINCE2 or Scrum certification', ['PRINCE2 Practitioner (2023)', 'Professional Scrum Master I']],
      ['Reporting on delivery KPIs, budgets or utilisation', ['Monthly utilisation and margin reports']],
      ['Hiring, onboarding or vendor management', ['Hired and onboarded 14 engineers']],
    ],
    highlights: ['Brought on-time delivery from 62% to 91% in a year.', 'Grew a key account from 3 to 11 developers.', 'Introduced weekly client health reviews.', 'Set up the business\'s first resourcing dashboard.'],
  },
  'Project Coordinator': {
    titles: ['Project Coordinator', 'Project Administrator', 'PMO Assistant', 'Operations Coordinator'],
    domains: ['at a software house', 'at a marketing agency', 'in IT services', 'in warehousing', 'at a startup'],
    skills: ['Jira', 'Trello', 'Asana', 'Minute taking', 'Scheduling', 'Microsoft 365', 'Client support', 'Excel', 'Notion', 'Data entry'],
    must: [
      ['1+ year coordinating projects, schedules or requests', ['2 years coordinating client projects', '18 months as a PMO assistant']],
      ['Uses a project tool such as Jira, ClickUp, Asana or Trello', ['Daily Jira board upkeep', 'Asana for 5 client projects']],
      ['Keeps meeting notes, action lists and follow-ups', ['Owns minutes and action logs for weekly calls']],
      ['Clear written English', ['Drafts client update emails', 'Writes weekly status summaries']],
    ],
    nice: [
      ['Experience in a fast-paced office or agency', ['Worked at a 40-person software house']],
      ['Strong Excel skills', ['Builds trackers with lookups and pivot tables']],
    ],
    highlights: ['Keeps 5 projects on schedule at once.', 'Set up a shared tracker that cut status-meeting time.', 'First point of contact for client requests.', 'Handles onboarding for new starters.'],
  },
};

// Match score: must-haves count 80%, nice-to-haves 20%; "unclear" counts half. Explained item by item.
function matchScore(a) {
  if (!a || a.status !== 'done' || !a.must || !a.must.length) return null;
  const part = (items) => (items.length ? items.reduce((s, c) => s + (c.s === 'met' ? 1 : c.s === 'unclear' ? 0.5 : 0), 0) / items.length : 1);
  return Math.round((part(a.must) * 0.8 + part(a.nice || []) * 0.2) * 100);
}
function matchTier(score) {
  if (score == null) return { key: 'none', label: 'Not scored' };
  if (score >= 80) return { key: 'strong', label: 'Strong match' };
  if (score >= 60) return { key: 'good', label: 'Good match' };
  if (score >= 40) return { key: 'partial', label: 'Partial match' };
  return { key: 'low', label: 'Low match' };
}

const RTW_TYPES = {
  citizen: { label: 'UK citizen', tone: 'green', detail: 'CV mentions a British passport' },
  settled: { label: 'Settled status', tone: 'green', detail: 'CV mentions EU Settlement Scheme (settled status)' },
  graduate: { label: 'Graduate visa', tone: 'amber', detail: 'CV mentions a Graduate visa valid until June 2027' },
  sponsor: { label: 'Needs sponsorship', tone: 'red', detail: 'CV says a Skilled Worker visa sponsor would be needed' },
  unknown: { label: 'Not stated', tone: 'grey', detail: 'The CV doesn\'t mention right to work' },
};
const SOURCES = ['Indeed', 'LinkedIn', 'Reed', 'CV-Library', 'Totaljobs', 'Direct email', 'Referral', 'Talent pool'];

// A Date for hh:mm UK time on the given day, whatever timezone this PC is in.
function londonTime(day, hh, mm) {
  const noon = new Date(Date.UTC(day.getFullYear(), day.getMonth(), day.getDate(), 12));
  const wall = (tz) => new Date(noon.toLocaleString('en-US', { timeZone: tz }));
  const offset = wall('Europe/London') - wall('UTC');
  return new Date(Date.UTC(day.getFullYear(), day.getMonth(), day.getDate(), hh, mm) - offset);
}

function buildSampleWorkspace() {
  const seed = (s) => () => { s |= 0; s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const rnd = seed(20261017);
  const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
  const pickN = (arr, n) => [...arr].sort(() => rnd() - 0.5).slice(0, n);
  const weighted = (pairs) => { const total = pairs.reduce((s, p) => s + p[1], 0); let r = rnd() * total; for (const p of pairs) { r -= p[1]; if (r <= 0) return p; } return pairs[0]; };
  const NOW = Date.now();
  const H = 3600000, D = 24 * H;
  const iso = (ms) => new Date(ms).toISOString();
  const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;

  const team = [
    { id: 'u1', name: 'Sarah Mitchell', title: 'Senior Consultant', desk: 'Projects & Delivery' },
    { id: 'u2', name: 'Imran Qadir', title: 'Consultant', desk: 'QA & Testing' },
    { id: 'u3', name: 'Jess Thornton', title: 'Consultant', desk: 'QA & Testing' },
    { id: 'u4', name: 'Ollie Grant', title: 'Resourcer', desk: 'Talent pool' },
  ];
  const clients = [
    { id: 'c1', name: 'Ashgrove Payments', sector: 'Fintech', contact: 'Rachel Doyle', contactTitle: 'Head of QA', email: 'rachel.doyle@ashgrove.example' },
    { id: 'c2', name: 'Copperleaf Software', sector: 'SaaS', contact: 'Martin Okafor', contactTitle: 'Engineering Manager', email: 'martin.okafor@copperleaf.example' },
    { id: 'c3', name: 'Northvale Retail', sector: 'Retail', contact: 'Helen Briggs', contactTitle: 'QA Lead', email: 'helen.briggs@northvale.example' },
    { id: 'c4', name: 'Brackenford Digital', sector: 'Digital agency', contact: 'David Lowe', contactTitle: 'Managing Director', email: 'david.lowe@brackenford.example' },
    { id: 'c5', name: 'Kestrel Lane Logistics', sector: 'Logistics', contact: 'Amara Clarke', contactTitle: 'Operations Director', email: 'amara.clarke@kestrellane.example' },
  ];
  const PERM_DOCS = ['Right to work check', 'Two references', 'Qualifications'];
  const jobs = [
    { id: 'J101', title: 'Automation Test Engineer', clientId: 'c1', family: 'Automation Test Engineer', city: 'Manchester', workType: 'Hybrid', type: 'Permanent', pay: '£48k–56k', band: [48, 56], owner: 'u2', openedDays: 21, closesDays: 9, count: 20, compliance: PERM_DOCS },
    { id: 'J102', title: 'Senior SDET', clientId: 'c2', family: 'Automation Test Engineer', city: 'Remote (UK)', workType: 'Remote', type: 'Contract · 6 months', pay: '£450–500/day', band: [450, 500], owner: 'u3', openedDays: 12, closesDays: 5, count: 14, compliance: ['Right to work check', 'Proof of ID', 'IR35 status form'] },
    { id: 'J103', title: 'QA Engineer', clientId: 'c3', family: 'QA Engineer / SDET', city: 'Leeds', workType: 'On-site', type: 'Permanent', pay: '£36k–42k', band: [36, 42], owner: 'u3', openedDays: 26, closesDays: 4, count: 26, compliance: ['Right to work check', 'Two references', 'Basic DBS check'] },
    { id: 'J104', title: 'Project Operations Manager', clientId: 'c4', family: 'Project Operations Manager', city: 'London', workType: 'Hybrid', type: 'Permanent', pay: '£58k–66k', band: [58, 66], owner: 'u1', openedDays: 18, closesDays: 12, count: 16, compliance: PERM_DOCS },
    { id: 'J105', title: 'Delivery Manager', clientId: 'c5', family: 'Project Operations Manager', city: 'Birmingham', workType: 'Hybrid', type: 'Permanent', pay: '£52k–60k', band: [52, 60], owner: 'u1', openedDays: 9, closesDays: 21, count: 10, compliance: PERM_DOCS },
    { id: 'J106', title: 'Project Coordinator', clientId: 'c5', family: 'Project Coordinator', city: 'Birmingham', workType: 'On-site', type: 'Temp · 3 months', pay: '£16.50/hour', band: [16.5, 16.5], owner: 'u1', openedDays: 14, closesDays: 2, count: 18, compliance: ['Right to work check', 'Proof of ID', 'Proof of address', 'National Insurance number', 'Bank details for payroll'] },
    { id: 'J107', title: 'QA Analyst', clientId: 'c2', family: 'QA Engineer / SDET', city: 'Remote (UK)', workType: 'Remote', type: 'Permanent', pay: '£40k–45k', band: [40, 45], owner: 'u2', openedDays: 40, closesDays: -6, count: 0, compliance: PERM_DOCS, status: 'Filled', filledNote: 'Filled 6 days ago by a talent pool candidate' },
  ].map((j) => ({
    ...j, status: j.status || 'Open',
    location: j.city === 'Remote (UK)' ? 'Remote (UK)' : `${j.city} · ${j.workType}`,
    openedAt: iso(NOW - j.openedDays * D), closesAt: iso(NOW + j.closesDays * D),
    must: FAMILIES[j.family].must.map((m) => m[0]), nice: FAMILIES[j.family].nice.map((m) => m[0]),
  }));
  const JOB = Object.fromEntries(jobs.map((j) => [j.id, j]));
  const CLIENT = Object.fromEntries(clients.map((c) => [c.id, c]));
  const TEAM = Object.fromEntries(team.map((u) => [u.id, u]));

  const FIRST = ['Ayesha', 'Bilal', 'Hira', 'Usman', 'Zainab', 'Daniel', 'Priya', 'Omar', 'Sana', 'Hamza', 'Fatima', 'James', 'Ali', 'Mehwish', 'Arjun', 'Sara', 'Kamran', 'Emily', 'Rehan', 'Nida', 'Tom', 'Areeba', 'Faisal', 'Laiba', 'Saad', 'Maryam', 'Ahmed', 'Chloe', 'Zoya', 'Waqas', 'Iqra', 'Noman', 'Rida', 'Talha', 'Aiman', 'Ibrahim', 'Komal', 'Anum', 'Haris', 'Mahnoor', 'Raza', 'Hannah', 'Owais', 'Tehreem', 'Esha', 'Moiz', 'Alina', 'Shayan'];
  const LAST = ['Siddiqui', 'Ahmed', 'Malik', 'Tariq', 'Raza', 'Hughes', 'Nair', 'Farooq', 'Javed', 'Qureshi', 'Noor', 'Whitfield', 'Haider', 'Khan', 'Mehta', 'Iqbal', 'Sheikh', 'Carter', 'Aslam', 'Hussain', 'Bennett', 'Shah', 'Mirza', 'Anwar', 'Rehman', 'Butt', 'Nawaz', 'Barker', 'Kazmi', 'Saleem', 'Sadiq', 'Zahid', 'Yusuf', 'Shahid', 'Riaz', 'Abbas', 'Price', 'Akram', 'Lodhi', 'Chaudhry'];
  const POOL_FIRST = ['Adam', 'Bushra', 'Callum', 'Dua', 'Ethan', 'Farah', 'George', 'Huma', 'Isaac', 'Javeria', 'Kieran', 'Lubna', 'Mason', 'Noreen', 'Oscar', 'Parveen', 'Rory', 'Saima', 'Theo', 'Umaima', 'Vikram', 'Wajiha', 'Yasir', 'Zara', 'Ben', 'Asma', 'Luke', 'Rabia', 'Nathan', 'Sidra'];
  const POOL_LAST = ['Ellis', 'Ghani', 'Foster', 'Bajwa', 'Holmes', 'Rana', 'Wood', 'Mughal', 'Hart', 'Cheema', 'Lane', 'Gill', 'Webb', 'Durrani', 'Fox', 'Bhatti', 'Mills', 'Afridi', 'Reid', 'Kayani', 'Moss', 'Jamil', 'Cole', 'Hashmi', 'Rowe', 'Saeed', 'Day', 'Pirzada', 'Kerr', 'Usmani'];
  const UK_CITIES = ['London', 'Manchester', 'Birmingham', 'Leeds', 'Bristol', 'Nottingham', 'Sheffield', 'Glasgow', 'Liverpool', 'Leicester'];
  const NOTICE = ['Immediate', 'Immediate', '1 week', '2 weeks', '1 month', '1 month', '3 months'];
  const SOURCE_MIX = [['Indeed', 30, -0.03], ['LinkedIn', 22, 0.06], ['Reed', 15, 0.05], ['CV-Library', 10, 0], ['Totaljobs', 9, -0.1], ['Direct email', 9, 0.02], ['Referral', 5, 0.15]];
  const RTW_MIX = [['citizen', 46], ['settled', 19], ['graduate', 10], ['sponsor', 8], ['unknown', 17]];

  // Builds the checklist and profile fields for one person against a role family.
  const profile = (family, strength) => {
    const F = FAMILIES[family];
    const status = () => { const r = rnd(); return r < strength ? 'met' : r < strength + 0.22 ? 'unclear' : 'missing'; };
    const must = F.must.map(([i, ev]) => { const s = status(); return { i, s, e: s === 'met' ? pick(ev) : s === 'missing' ? 'Not mentioned in the CV' : '' }; });
    const nice = F.nice.map(([i, ev]) => { const s = rnd() < strength - 0.15 ? 'met' : rnd() < 0.5 ? 'unclear' : 'missing'; return { i, s, e: s === 'met' ? pick(ev) : s === 'missing' ? 'Not mentioned in the CV' : '' }; });
    const years = family === 'Project Coordinator' ? 1 + Math.round(strength * 3) : Math.max(2, Math.round(2 + strength * (family === 'Project Operations Manager' ? 8 : 6) + rnd() * 1.5));
    const title = years >= 6 && rnd() < 0.6 ? F.titles[F.titles.length - 1] : pick(F.titles.slice(0, -1));
    const skills = pickN(F.skills, 4 + Math.floor(rnd() * 3));
    const domain = pick(F.domains);
    const gaps = [...must, ...nice].filter((c) => c.s !== 'met');
    return {
      must, nice, title, skills, domain, years,
      exp: plural(years, 'year'),
      summary: `${title} with ${plural(years, 'year')} ${domain}, strongest in ${skills.slice(0, 2).join(' and ')}. ${pick(F.highlights)}`,
      qs: gaps.slice(0, 3).map((c) => `Can you give an example of your experience with: ${c.i.charAt(0).toLowerCase()}${c.i.slice(1)}?`),
    };
  };
  const rtwOf = () => { const k = weighted(RTW_MIX)[0]; return { key: k, ...RTW_TYPES[k] }; };
  const salaryFor = (job, strength) => {
    if (job.type.startsWith('Contract')) return `£${Math.round((job.band[0] - 30 + strength * 90) / 5) * 5}/day`;
    if (job.type.startsWith('Temp')) return `£${(15.5 + strength * 2).toFixed(2)}/hour`;
    return `£${Math.round(job.band[0] - 4 + strength * (job.band[1] - job.band[0] + 8))}k`;
  };

  // ---------------------------------------------------------------- applicants
  const candidates = [];
  let n = 0;
  for (const job of jobs) {
    for (let k = 0; k < job.count; k++) {
      const first = FIRST[n % FIRST.length];
      const last = LAST[(n * 7 + 3) % LAST.length];
      n++;
      const [source, , bias] = weighted(SOURCE_MIX);
      const strength = Math.min(0.86, Math.max(0.1, 0.12 + rnd() * 0.72 + bias));
      const p = profile(job.family, strength);
      const hoursAgo = Math.pow(rnd(), 1.5) * job.openedDays * 24 + 0.4;
      const at = NOW - hoursAgo * H;
      const owner = rnd() < 0.85 ? job.owner : pick(team).id;
      const city = job.city === 'Remote (UK)' ? pick(UK_CITIES) : rnd() < 0.65 ? job.city : pick(UK_CITIES);
      const aiSeconds = 6 + Math.floor(rnd() * 9);
      const c = {
        id: `C${String(n).padStart(3, '0')}`,
        name: `${first} ${last}`, first,
        email: `${first}.${last}@example.com`.toLowerCase(),
        phone: `07700 900${String(100 + n).slice(-3)}`,
        at: iso(at), jobId: job.id, role: job.family, roleGuessed: false,
        status: 'done', decision: 'new', source,
        why: source === 'Direct email' ? 'Emailed the inbox directly, CV attached' : `Job board alert from ${source}, CV attached`,
        cv: 'demo', cvName: `${first}_${last}_CV.pdf`, cvNote: '',
        cover: `Dear Hiring Team,\n\nI'd like to apply for the ${job.title} role. I have ${plural(p.years, 'year')} of experience as ${/^([AEIOU]|SDET)/.test(p.title) ? 'an' : 'a'} ${p.title} ${p.domain}, and my CV is attached.\n\nKind regards,\n${first} ${last}`,
        summary: p.summary, title: p.title, exp: p.exp, loc: city, avail: pick(NOTICE), salary: salaryFor(job, strength),
        skills: p.skills, must: p.must, nice: p.nice, qs: p.qs,
        model: 'gpt-5-mini', tokens: 1900 + Math.floor(rnd() * 1400), error: '', aiSeconds,
        rtw: rtwOf(), owner,
        docs: job.compliance.map((name) => ({ name, state: 'missing' })),
        notes: [], messages: [], interview: null, dup: '',
        events: [
          { at: iso(at), by: 'system', text: `Application received via ${source}` },
          { at: iso(at + 45000), by: 'system', text: 'Acknowledgement email sent automatically' },
          { at: iso(at + aiSeconds * 1000), by: 'system', text: 'AI summary and match score ready' },
          { at: iso(at + 60000), by: 'system', text: `Assigned to ${TEAM[owner].name}` },
        ],
      };
      c.score = matchScore(c);
      candidates.push(c);
    }
  }

  // Move people along the pipeline: per job, the best are shortlisted or in interview, the weakest "not now".
  const slots = [[10, 30], [11, 30], [14, 0], [15, 30], [9, 30], [13, 0]];
  let slotIndex = 0;
  const nextWorkday = (count) => { const d = new Date(NOW); let left = count; while (left > 0) { d.setDate(d.getDate() + 1); if (![0, 6].includes(d.getDay())) left--; } return d; };
  const at = (day, hh, mm) => londonTime(day, hh, mm);
  for (const job of jobs) {
    const list = candidates.filter((c) => c.jobId === job.id).sort((a, b) => b.score - a.score);
    const reviewedAt = (c, hrs) => Math.min(NOW - (0.3 + rnd() * 6) * H, new Date(c.at).getTime() + hrs * H);
    list.forEach((c, i) => {
      const client = CLIENT[job.clientId];
      const by = c.owner;
      const other = () => pick(team.filter((u) => u.id !== by));
      if ((i < 2 && list.length > 8) || i < 1) {
        c.decision = 'interview';
        const t1 = reviewedAt(c, 3), t2 = reviewedAt(c, 26);
        // Unique day/time pairs: four days ahead, then the next time slot.
        const [hh, mm] = slots[Math.floor(slotIndex / 4) % slots.length];
        const day = at(nextWorkday(1 + (slotIndex % 4)), hh, mm);
        slotIndex++;
        c.interview = { at: day.toISOString(), format: pick(['Video call (Teams)', 'Video call (Teams)', 'On-site at client', 'Phone']), duration: 45, with: [TEAM[by].name, client.contact], status: rnd() < 0.75 ? 'Confirmed' : 'Awaiting reply' };
        c.docs.forEach((d, di) => { d.state = di === 0 || rnd() < 0.6 ? 'received' : 'requested'; });
        c.events.push({ at: iso(t1), by, text: 'Moved to Shortlisted' }, { at: iso(t1 + 6e5), by, text: `Requested documents: ${job.compliance.join(', ')}` },
          { at: iso(t2), by, text: 'Moved to Interview' }, { at: iso(t2 + 3e5), by, text: `Interview booked for ${day.toLocaleString('en-GB', { timeZone: 'Europe/London', weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}` });
        c.messages = [
          { at: iso(t1 + 9e5), dir: 'out', channel: 'WhatsApp', by, text: `Hi ${c.first}, it's ${TEAM[by].name.split(' ')[0]} from Harbourline Recruitment. Are you still interested in the ${job.title} role with ${client.name}?` },
          { at: iso(t1 + 9e5 + 22 * 60000), dir: 'in', channel: 'WhatsApp', text: pick([`Hi ${TEAM[by].name.split(' ')[0]}, yes definitely! Happy to talk any time after 5pm.`, 'Yes, still very interested. When would the interview be?', 'Hi! Yes please, this one sounds like a great fit.']) },
          { at: iso(t2 + 4e5), dir: 'out', channel: 'WhatsApp', by, text: 'Great news: the client would like to meet you. I\'ve just emailed the interview invite.' },
        ];
        c.notes = [{ at: iso(t1 + 3e5), by, text: `Spoke on the phone. Clear communicator, keen on ${job.workType.toLowerCase()} working, and the ${job.type.startsWith('Perm') ? 'salary' : 'rate'} expectation fits the band.` }];
        if (rnd() < 0.7) c.notes.push({ at: iso(t1 + 4e6), by: other().id, text: `@${TEAM[by].name.split(' ')[0]} ${client.contact.split(' ')[0]} liked this CV when I mentioned it. Worth moving quickly, they have another interview on Friday.` });
      } else if (i < (list.length > 12 ? 5 : 3)) {
        c.decision = 'shortlisted';
        const t1 = reviewedAt(c, 4);
        c.docs.forEach((d, di) => { d.state = di === 0 && rnd() < 0.5 ? 'received' : 'requested'; });
        c.events.push({ at: iso(t1), by, text: 'Moved to Shortlisted' }, { at: iso(t1 + 6e5), by, text: `Requested documents: ${job.compliance.join(', ')}` });
        c.notes = [{ at: iso(t1 + 2e5), by, text: pick([`Strong on ${c.skills[0]}. Worth a technical screen before we put them forward.`, `Available ${c.avail.toLowerCase()}. Asked for ${c.salary}, which is inside the band.`, `@${other().name.split(' ')[0]} can you double-check the dates on the last two roles?`]) }];
      } else if (i >= list.length - 2 && list.length > 6) {
        c.decision = 'not_now';
        c.events.push({ at: iso(reviewedAt(c, 5)), by, text: 'Moved to Not now' });
      }
    });
  }
  candidates.sort((a, b) => String(b.at).localeCompare(String(a.at)));
  candidates[5].dup = 'Also applied 12 days ago';
  candidates[17].dup = 'Also applied for another job here';
  candidates[40].dup = 'Also applied 3 weeks ago';

  // ---------------------------------------------------------------- talent pool (past candidates)
  const pastClients = ['Ridgeway Insurance', 'Elmstead Energy', 'Fernhill Bank', 'Ashgrove Payments', 'Northvale Retail', 'Copperleaf Software', 'Brackenford Digital'];
  const poolPlan = [['Automation Test Engineer', 55], ['QA Engineer / SDET', 50], ['Project Operations Manager', 45], ['Project Coordinator', 30]];
  const pool = [];
  let m = 0;
  for (const [family, howMany] of poolPlan) {
    for (let k = 0; k < howMany; k++) {
      const first = POOL_FIRST[m % POOL_FIRST.length];
      const last = POOL_LAST[(m * 11 + 5 + Math.floor(m / POOL_FIRST.length) * 7) % POOL_LAST.length];
      m++;
      const strength = Math.min(0.86, Math.max(0.1, 0.1 + rnd() * 0.74));
      const p = profile(family, strength);
      const daysAgo = 45 + Math.floor(Math.pow(rnd(), 1.3) * 800);
      const person = {
        id: `P${String(m).padStart(3, '0')}`, name: `${first} ${last}`, first,
        email: `${first}.${last}@example.com`.toLowerCase(), phone: `07700 900${String(500 + m).slice(-3)}`,
        family, role: family, status: 'done', title: p.title, exp: p.exp, loc: pick(UK_CITIES), skills: p.skills,
        must: p.must, nice: p.nice, summary: p.summary, qs: p.qs, rtw: rtwOf(),
        lastContact: iso(NOW - daysAgo * D),
        history: `Applied for ${pick(FAMILIES[family].titles)} at ${pick(pastClients)}`,
        availability: 'Unknown', addedTo: [],
      };
      person.score = matchScore(person);
      pool.push(person);
    }
  }

  // ---------------------------------------------------------------- outbox
  const outbox = [];
  let o = 0;
  const add = (e) => outbox.push({ id: `M${String(++o).padStart(4, '0')}`, ...e });
  for (const c of candidates) {
    const job = JOB[c.jobId];
    const client = CLIENT[job.clientId];
    add({ at: iso(new Date(c.at).getTime() + 45000), channel: 'Email', kind: 'ack', toName: c.name, to: c.email, candId: c.id, jobId: c.jobId, status: 'Sent',
      subject: `We've received your application: ${job.title}`,
      body: `Hi ${c.first},\n\nThanks for applying for the ${job.title} role (${job.location}). We've received your CV and a consultant will review it shortly.\n\nIf your experience is a good fit, we'll be in touch within 3 working days.\n\nBest wishes,\nHarbourline Recruitment` });
    const docsEv = c.events.find((e) => e.text.startsWith('Requested documents'));
    if (docsEv) add({ at: docsEv.at, channel: 'Email', kind: 'docs', toName: c.name, to: c.email, candId: c.id, jobId: c.jobId, status: 'Sent', subject: `Documents needed: ${job.title}`, body: `Hi ${c.first},\n\nTo put you forward for the ${job.title} role, please upload these through your secure link:\n\n${job.compliance.map((d) => `• ${d}`).join('\n')}\n\nThanks,\n${TEAM[c.owner].name}\nHarbourline Recruitment` });
    if (c.interview) {
      const ev = c.events.find((e) => e.text.startsWith('Interview booked'));
      add({ at: ev.at, channel: 'Email', kind: 'invite', toName: c.name, to: c.email, candId: c.id, jobId: c.jobId, status: 'Sent', subject: `Interview: ${job.title} with ${client.name}`, body: `Hi ${c.first},\n\nGreat news: ${client.name} would like to interview you for the ${job.title} role.\n\n${new Date(c.interview.at).toLocaleString('en-GB', { timeZone: 'Europe/London', weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })} · ${c.interview.format} · ${c.interview.duration} minutes\nWith: ${c.interview.with.join(', ')}\n\nPlease reply to confirm.\n\nBest wishes,\n${TEAM[c.owner].name}` });
      for (const msg of c.messages.filter((x) => x.dir === 'out')) add({ at: msg.at, channel: 'WhatsApp', kind: 'message', toName: c.name, to: c.phone, candId: c.id, jobId: c.jobId, status: 'Read', subject: 'WhatsApp message', body: msg.text });
    }
    if (c.decision === 'not_now') {
      const ev = c.events.find((e) => e.text === 'Moved to Not now');
      add({ at: ev.at, channel: 'Email', kind: 'decline', toName: c.name, to: c.email, candId: c.id, jobId: c.jobId, status: 'Draft', subject: `Your application: ${job.title}`, body: `Hi ${c.first},\n\nThank you for applying for the ${job.title} role and for the time you put into your application.\n\nWe've reviewed it carefully and have decided to move forward with candidates whose experience more closely matches what the client needs right now.\n\nWe'll keep your details on file and may contact you about future roles that fit your background.\n\nBest wishes,\nHarbourline Recruitment` });
    }
  }
  const j101 = candidates.filter((c) => c.jobId === 'J101' && ['shortlisted', 'interview'].includes(c.decision));
  add({ at: iso(NOW - 2 * D - 3 * H), channel: 'Email', kind: 'shortlist', toName: 'Rachel Doyle', to: CLIENT.c1.email, candId: null, jobId: 'J101', status: 'Sent', subject: `Shortlist: Automation Test Engineer (${j101.length} candidates)`, body: `Hi Rachel,\n\nHere's the shortlist for the Automation Test Engineer role: ${j101.length} candidates, each with a short summary and how they match your checklist.\n\nOpen the shortlist: https://share.harbourline.example/s/7KX2-ASH\n\nBest wishes,\nImran Qadir\nHarbourline Recruitment` });
  outbox.sort((a, b) => String(b.at).localeCompare(String(a.at)));

  return {
    version: 4, me: 'u1', agency: 'Harbourline Recruitment',
    team, clients, jobs, candidates, pool, outbox,
    automations: { acknowledge: true, declines: 'draft', reminders: true },
  };
}
