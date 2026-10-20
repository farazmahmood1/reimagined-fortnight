// Fictional demo data for "Harbourline Recruitment". Every name, company, email and phone number is made up.
// Emails use the reserved .example domain; phone numbers use Ofcom's drama range (07700 900xxx).

export const CONFIG = [
  { key: 'agency_name', value: 'Harbourline Recruitment' },
  { key: 'consultant_name', value: 'Sophie Clarke' },
  { key: 'consultant_email', value: 'sophie.clarke@harbourline.example' },
  { key: 'payroll_email', value: 'payroll@harbourline.example' },
  { key: 'compliance_email', value: 'compliance@harbourline.example' },
  { key: 'base_url', value: 'http://localhost:5678' },
  { key: 'national_living_wage', value: '12.71' },
  { key: 'sms_enabled', value: 'false' },
  { key: 'email_enabled', value: 'false' },
];

export const CLIENTS = [
  { client_id: 'C001', name: 'Meridian Logistics Ltd', site: 'Warehouse, Daventry', manager_name: 'Dan Whitfield', manager_email: 'dan.whitfield@meridian.example', manager_phone: '+447700900101' },
  { client_id: 'C002', name: 'Kestrel Foods Ltd', site: 'Production, Leeds', manager_name: 'Priya Shah', manager_email: 'priya.shah@kestrelfoods.example', manager_phone: '+447700900102' },
  { client_id: 'C003', name: 'Alder & Finch Facilities', site: 'Office services, Manchester', manager_name: 'Tom Reeves', manager_email: 'tom.reeves@alderfinch.example', manager_phone: '+447700900103' },
];

export const UMBRELLAS = [
  { umbrella_id: 'U001', name: 'Northstar Umbrella Ltd', contact_name: 'Payroll team', contact_email: 'payroll@northstar-umbrella.example' },
  { umbrella_id: 'U002', name: 'Clearwater Umbrella Ltd', contact_name: 'Compliance desk', contact_email: 'compliance@clearwater-umbrella.example' },
];

// pay_route: PAYE (agency payroll) or the umbrella_id. pay_rate is the hourly rate the agency pays
// (to the worker for PAYE, or the assignment rate paid to the umbrella company).
export const TEMPS = [
  { temp_id: 'T001', first_name: 'Aisha', last_name: 'Khan', phone: '+447700900201', email: 'aisha.khan@mail.example', client_id: 'C001', role: 'Warehouse operative', pay_route: 'PAYE', pay_rate: 13.5, charge_rate: 18.9 },
  { temp_id: 'T002', first_name: 'Jake', last_name: 'Morris', phone: '+447700900202', email: 'jake.morris@mail.example', client_id: 'C001', role: 'Forklift driver', pay_route: 'U001', pay_rate: 17.2, charge_rate: 20.6 },
  { temp_id: 'T003', first_name: 'Olivia', last_name: 'Bennett', phone: '+447700900203', email: 'olivia.bennett@mail.example', client_id: 'C002', role: 'Production operative', pay_route: 'PAYE', pay_rate: 13.0, charge_rate: 18.2 },
  { temp_id: 'T004', first_name: 'Marek', last_name: 'Nowak', phone: '+447700900204', email: 'marek.nowak@mail.example', client_id: 'C002', role: 'Line leader', pay_route: 'U002', pay_rate: 16.8, charge_rate: 20.1 },
  { temp_id: 'T005', first_name: 'Chloe', last_name: 'Davies', phone: '+447700900205', email: 'chloe.davies@mail.example', client_id: 'C003', role: 'Receptionist', pay_route: 'PAYE', pay_rate: 14.2, charge_rate: 19.9 },
  { temp_id: 'T006', first_name: 'Samuel', last_name: 'Okoro', phone: '+447700900206', email: 'samuel.okoro@mail.example', client_id: 'C001', role: 'Forklift driver', pay_route: 'U001', pay_rate: 17.2, charge_rate: 20.6 },
  { temp_id: 'T007', first_name: 'Hannah', last_name: 'Lewis', phone: '+447700900207', email: 'hannah.lewis@mail.example', client_id: 'C003', role: 'Facilities coordinator', pay_route: 'U002', pay_rate: 18.0, charge_rate: 21.6 },
  { temp_id: 'T008', first_name: 'Ryan', last_name: 'Patel', phone: '+447700900208', email: 'ryan.patel@mail.example', client_id: 'C002', role: 'Production operative', pay_route: 'PAYE', pay_rate: 13.0, charge_rate: 18.2 },
];

// Last week's timesheets (the most recent Sunday before today): a realistic Monday mix.
export const TIMESHEETS_THIS_WEEK = [
  { temp_id: 'T001', status: 'missing' },
  { temp_id: 'T002', status: 'approved', hours: 42 },
  { temp_id: 'T003', status: 'missing' },
  { temp_id: 'T004', status: 'submitted', hours: 40 },
  { temp_id: 'T005', status: 'approved', hours: 37.5 },
  { temp_id: 'T006', status: 'missing' },
  { temp_id: 'T007', status: 'approved', hours: 35 },
  { temp_id: 'T008', status: 'missing' },
];

// The previous calendar month, already approved and exported: used to check umbrella payslips.
export const LAST_MONTH_HOURS = {
  T002: [40, 40, 40, 40],
  T004: [40, 40, 40, 40],
  T006: [38, 36, 40, 36],
  T007: [35, 35, 35, 35],
};

// Required documents and their state. expires_in_days is relative to the day you reset the demo,
// so the story is the same whenever you record it (null = no expiry date).
export const DOCUMENTS = [
  { temp_id: 'T001', doc_type: 'Right to work', status: 'verified', expires_in_days: null },
  { temp_id: 'T001', doc_type: 'Site induction', status: 'verified', expires_in_days: 169 },
  { temp_id: 'T002', doc_type: 'Right to work', status: 'verified', expires_in_days: null },
  { temp_id: 'T002', doc_type: 'Forklift licence', status: 'verified', expires_in_days: 260 },
  { temp_id: 'T003', doc_type: 'Right to work', status: 'verified', expires_in_days: null },
  { temp_id: 'T003', doc_type: 'Food hygiene certificate', status: 'verified', expires_in_days: 94 },
  { temp_id: 'T004', doc_type: 'Right to work', status: 'verified', expires_in_days: 14 },
  { temp_id: 'T004', doc_type: 'Food hygiene certificate', status: 'verified', expires_in_days: 138 },
  { temp_id: 'T005', doc_type: 'Right to work', status: 'verified', expires_in_days: null },
  { temp_id: 'T005', doc_type: 'Basic DBS check', status: 'received', expires_in_days: null },
  { temp_id: 'T006', doc_type: 'Right to work', status: 'verified', expires_in_days: null },
  { temp_id: 'T006', doc_type: 'Forklift licence', status: 'verified', expires_in_days: -12 },
  { temp_id: 'T007', doc_type: 'Right to work', status: 'verified', expires_in_days: null },
  { temp_id: 'T007', doc_type: 'Basic DBS check', status: 'verified', expires_in_days: null },
  { temp_id: 'T008', doc_type: 'Right to work', status: 'verified', expires_in_days: null },
  { temp_id: 'T008', doc_type: 'Food hygiene certificate', status: 'missing', expires_in_days: null },
];
