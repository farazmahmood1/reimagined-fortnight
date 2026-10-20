// Starting values for the inbox triage workflow. They are copied into the "Triage roles" and
// "Triage settings" data tables on first setup; after that, edit the tables in n8n instead.

export const DEFAULT_SETTINGS = [
  // AI stays off until someone switches it on from the dashboard. Nothing is sent to OpenAI before that.
  { key: 'ai_enabled', value: 'false' },
  // Small, cheap model: the job is reading a CV against a checklist, not deep reasoning.
  { key: 'ai_model', value: 'gpt-5-nano' },
  // Sent as reasoning_effort for reasoning models. Leave blank for models that don't take it.
  { key: 'ai_reasoning_effort', value: 'minimal' },
  // CVs summarised per click of the dashboard button.
  { key: 'ai_batch_size', value: '10' },
  // CV text is cut to this many characters before it is sent (about 1,500 tokens).
  { key: 'max_cv_chars', value: '6000' },
  // Mail from this domain is never treated as an application.
  { key: 'own_domain', value: 'forrof' },
];

// keywords: comma-separated, matched in the subject (strong) and body (weak).
// must_haves / nice_to_haves: one per line. The AI marks each one met / missing / unclear.
export const DEFAULT_ROLES = [
  {
    role: 'Project Operations Manager',
    keywords: 'project operations manager, operations manager, project operations, ops manager, project manager, operations, delivery manager',
    must_haves: [
      '4+ years running projects or operations in a software, IT services or digital agency',
      'Day-to-day communication with international (UK, US or EU) clients',
      'Hands-on use of a project tool such as Jira, ClickUp, Asana or Trello',
      'Planning and coordinating work across developers, designers and QA',
      'Clear written and spoken English',
    ].join('\n'),
    nice_to_haves: [
      'PMP, PRINCE2 or Scrum certification',
      'Reporting on delivery KPIs, budgets or utilisation',
      'Hiring, onboarding or vendor management',
    ].join('\n'),
  },
  {
    role: 'Project Coordinator',
    keywords: 'project coordinator, coordinator, project associate, pmo, project assistant',
    must_haves: [
      '1+ year coordinating projects, schedules or client requests',
      'Uses a project tool such as Jira, ClickUp, Asana or Trello',
      'Keeps meeting notes, action lists and follow-ups',
      'Clear written English',
    ].join('\n'),
    nice_to_haves: [
      'Experience in a software or digital agency',
      'Basic Agile or Scrum knowledge',
    ].join('\n'),
  },
  {
    role: 'Automation Test Engineer',
    keywords: 'automation test engineer, test automation, automation engineer, automation testing, automation tester, selenium, playwright, cypress',
    must_haves: [
      '3+ years of test automation on web applications',
      'Builds or maintains a framework with Selenium, Playwright or Cypress',
      'Writes automation code in Java, JavaScript/TypeScript or Python',
      'API testing or automation (Postman, Rest Assured or similar)',
      'Runs tests in CI/CD and uses Git',
    ].join('\n'),
    nice_to_haves: [
      'BDD with Cucumber or similar',
      'Mobile automation (Appium)',
      'Performance testing (JMeter, k6)',
    ].join('\n'),
  },
  {
    role: 'QA Engineer / SDET',
    keywords: 'qa engineer, sdet, quality assurance, qa analyst, manual testing, software tester, qa tester, tester',
    must_haves: [
      '2+ years of QA on web or mobile applications',
      'Writes test cases and clear bug reports',
      'Tracks bugs in Jira or a similar tool',
      'Some test automation (Selenium, Playwright, Cypress or similar)',
      'API testing with Postman or similar',
    ].join('\n'),
    nice_to_haves: [
      'ISTQB certification',
      'Database / SQL testing',
      'Experience in Agile teams',
    ].join('\n'),
  },
];
