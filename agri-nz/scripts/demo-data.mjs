// Fictional demo data for "Tussock Ridge Farming Ltd", a made-up Southland farming company.
// Every person, business, email, phone number and bank account is invented. Emails use the reserved .example domain.
// Phone numbers are +64 21 000 xxxx. New Zealand has no reserved fictional range, so the send workflow also
// refuses to deliver to these numbers and to .example addresses, even when live sending is switched on.
import { BASE_URL } from './env.mjs';

export const CONFIG = [
  { key: 'business_name', value: 'Tussock Ridge Farming Ltd' },
  { key: 'region', value: 'Southland' },
  { key: 'base_url', value: BASE_URL },
  { key: 'owner_name', value: 'Hamish Gordon' },
  { key: 'owner_email', value: 'hamish.gordon@tussockridge.example' },
  { key: 'owner_phone', value: '+64210000101' },
  { key: 'admin_name', value: 'Aroha Tipene' },
  { key: 'admin_email', value: 'aroha.tipene@tussockridge.example' },
  { key: 'admin_phone', value: '+64210000102' },
  { key: 'manager_name', value: 'Callum Reid' },
  { key: 'manager_email', value: 'callum.reid@tussockridge.example' },
  { key: 'manager_phone', value: '+64210000103' },
  { key: 'certifier_name', value: 'Rowan Pike' },
  { key: 'certifier_email', value: 'rowan.pike@southerncertifiers.example' },
  // Invoice rules
  { key: 'gst_rate', value: '0.15' },
  { key: 'manager_limit', value: '2500' },
  { key: 'price_tolerance_pct', value: '2' },
  { key: 'pay_day', value: '20' },
  // Farm plan
  { key: 'plan_deadline', value: '2027-11-27' },
  { key: 'plan_deadline_note', value: 'Southland: the due date for certified freshwater farm plans moved from 27 May 2026 to 27 November 2027 (Ministry for the Environment, May 2026). Rules are still changing, so this date is a setting.' },
  { key: 'reminder_days', value: '7' },
  { key: 'max_requests', value: '3' },
  // Consents and certificates
  { key: 'consent_plan_months', value: '8' },
  { key: 'consent_lodge_months', value: '6' },
  { key: 'consent_cutoff_months', value: '3' },
  { key: 'cert_soon_days', value: '30' },
  { key: 'cert_urgent_days', value: '7' },
  { key: 'sms_enabled', value: 'false' },
  { key: 'email_enabled', value: 'false' },
];

export const SUPPLIERS = [
  { supplier_id: 'S01', name: 'Aparima Fertiliser Ltd', category: 'Fertiliser', contact_name: 'Josh Henare', contact_email: 'accounts@aparima-fert.example', contact_phone: '+64210000108', bank_account: '03-0198-0456721-00' },
  { supplier_id: 'S02', name: 'Fiordland Stockfeeds Ltd', category: 'Feed', contact_name: 'Maree Dunbar', contact_email: 'accounts@fiordlandfeeds.example', contact_phone: '', bank_account: '02-0412-0087634-00' },
  { supplier_id: 'S03', name: 'Invercargill Fuel Services Ltd', category: 'Fuel', contact_name: 'Dale Hutchins', contact_email: 'accounts@ivcfuel.example', contact_phone: '', bank_account: '06-0813-0245190-00' },
  { supplier_id: 'S04', name: 'Riverton Rural Vets Ltd', category: 'Veterinary', contact_name: 'Kate Sorensen', contact_email: 'accounts@rivertonvets.example', contact_phone: '', bank_account: '12-3150-0098712-00' },
  { supplier_id: 'S05', name: 'Mataura Stock Cartage Ltd', category: 'Transport', contact_name: 'Wiremu Carr', contact_email: 'office@mataurastockcartage.example', contact_phone: '', bank_account: '01-1307-0176528-00' },
  { supplier_id: 'S06', name: 'Waiau Contracting Ltd', category: 'Contractor', contact_name: 'Brent Maxwell', contact_email: 'accounts@waiaucontracting.example', contact_phone: '', bank_account: '03-1599-0321876-00' },
  { supplier_id: 'S07', name: 'Southern Seed & Grain Ltd', category: 'Seed', contact_name: 'Lucy Fraser', contact_email: 'accounts@southernseed.example', contact_phone: '', bank_account: '38-9004-0123456-00' },
];

// Contracts are in force from 150 days ago to 215 days ahead, so they cover every demo invoice whenever you reset.
export const CONTRACTS = [
  { contract_id: 'K01', supplier_id: 'S01', item: 'Urea (46% N)', description: 'Urea 46% N, bulk and spread-ready, this season', unit: 't', agreed_price: 890, qty_agreed: 120, needs_docket: 'yes' },
  { contract_id: 'K02', supplier_id: 'S01', item: 'Lime', description: 'Ag lime, spread on farm', unit: 't', agreed_price: 62, qty_agreed: 400, needs_docket: 'yes' },
  { contract_id: 'K03', supplier_id: 'S02', item: 'PKE', description: 'Palm kernel expeller, bulk delivered', unit: 't', agreed_price: 395, qty_agreed: 300, needs_docket: 'yes' },
  { contract_id: 'K04', supplier_id: 'S03', item: 'Diesel', description: 'Farm diesel, bulk tank fill', unit: 'L', agreed_price: 1.78, qty_agreed: 24000, needs_docket: 'yes' },
  { contract_id: 'K05', supplier_id: 'S04', item: 'Vet consult', description: 'Herd health consults, hourly rate', unit: 'h', agreed_price: 168, qty_agreed: 120, needs_docket: 'no' },
  { contract_id: 'K06', supplier_id: 'S05', item: 'Stock cartage', description: 'Stock cartage, truck and trailer load', unit: 'load', agreed_price: 540, qty_agreed: 60, needs_docket: 'no' },
  { contract_id: 'K07', supplier_id: 'S06', item: 'Baleage wrapping', description: 'Baleage wrapping and stacking', unit: 'bale', agreed_price: 24.5, qty_agreed: 2400, needs_docket: 'no' },
];

// Delivery dockets signed on the farm. `forInvoice` ties a docket to a demo invoice (delivered two days before it).
export const DOCKETS = [
  { docket_ref: 'DK-20318', supplier_id: 'S01', item: 'Urea (46% N)', qty: 24, unit: 't', received_by: 'Callum Reid', invoice: 'A' },
  { docket_ref: 'DK-20344', supplier_id: 'S01', item: 'Urea (46% N)', qty: 18, unit: 't', received_by: 'Callum Reid', invoice: 'B' },
  { docket_ref: 'DK-51207', supplier_id: 'S02', item: 'PKE', qty: 27.5, unit: 't', received_by: 'Callum Reid', invoice: 'C' },
  { docket_ref: 'DK-90234', supplier_id: 'S03', item: 'Diesel', qty: 4000, unit: 'L', received_by: 'Callum Reid', invoice: 'D' },
  { docket_ref: 'DK-20361', supplier_id: 'S01', item: 'Lime', qty: 150, unit: 't', received_by: 'Fiona McLeod', invoice: 'M' },
  { docket_ref: 'DK-90118', supplier_id: 'S03', item: 'Diesel', qty: 3500, unit: 'L', received_by: 'Callum Reid', invoice: 'H1' },
  { docket_ref: 'DK-4471', supplier_id: 'S01', item: 'Urea (46% N)', qty: 40, unit: 't', received_by: 'Callum Reid', invoice: 'H3' },
  { docket_ref: 'DK-51102', supplier_id: 'S02', item: 'PKE', qty: 50, unit: 't', received_by: 'Callum Reid', invoice: 'H4' },
  // Deliveries signed for but not yet invoiced. The "Add an invoice" examples use these.
  { docket_ref: 'DK-20400', supplier_id: 'S01', item: 'Urea (46% N)', qty: 20, unit: 't', received_by: 'Callum Reid', days_ago: 3 },
  { docket_ref: 'DK-51260', supplier_id: 'S02', item: 'PKE', qty: 25, unit: 't', received_by: 'Callum Reid', days_ago: 2 },
  { docket_ref: 'DK-90301', supplier_id: 'S03', item: 'Diesel', qty: 3000, unit: 'L', received_by: 'Fiona McLeod', days_ago: 4 },
];

// This week's invoices, as if they arrived by email and have not been checked yet. `day` is the day of the invoice month.
// The month is chosen so every invoice is due on the next pay date (the 20th of the month following).
export const INVOICES = [
  { key: 'A', supplier_id: 'S01', ref: 'AF-77391', day: 3, item: 'Urea (46% N)', qty: 24, unit: 't', price: 890, docket: 'DK-20318' },
  { key: 'B', supplier_id: 'S01', ref: 'AF-77402', day: 5, item: 'Urea (46% N)', qty: 18, unit: 't', price: 925, docket: 'DK-20344' },
  { key: 'C', supplier_id: 'S02', ref: 'FS-5588', day: 6, item: 'PKE', qty: 30, unit: 't', price: 395, docket: 'DK-51207' },
  { key: 'D', supplier_id: 'S03', ref: 'IFS-30977', day: 9, item: 'Diesel', qty: 4000, unit: 'L', price: 1.78, docket: 'DK-90234', bank: '12-3401-0987650-00' },
  { key: 'E', supplier_id: 'S04', ref: 'RRV-2204', day: 10, item: 'Vet consult', qty: 6.5, unit: 'h', price: 170 },
  { key: 'F', supplier_id: 'S05', ref: 'MSC-0931', day: 11, item: 'Stock cartage', qty: 3, unit: 'load', price: 540 },
  { key: 'G', supplier_id: 'S06', ref: 'WC-1203', day: 12, item: 'Baleage wrapping', qty: 300, unit: 'bale', price: 24.5 },
  { key: 'I', supplier_id: 'S03', ref: 'IFS-30418', day: 13, item: 'Diesel', qty: 3500, unit: 'L', price: 1.78, docket: 'DK-90118' },
  { key: 'M', supplier_id: 'S01', ref: 'AF-77455', day: 14, item: 'Lime', qty: 150, unit: 't', price: 62, docket: 'DK-20361' },
];
// Paid in earlier months. They feed the volume check (how much of each contract is used) and the duplicate check.
export const HISTORY = [
  { key: 'H1', supplier_id: 'S03', ref: 'IFS-30418', day: 24, item: 'Diesel', qty: 3500, unit: 'L', price: 1.78, docket: 'DK-90118', contract_id: 'K04' },
  { key: 'H2', supplier_id: 'S06', ref: 'WC-1187', day: 15, item: 'Baleage wrapping', qty: 2100, unit: 'bale', price: 24.5, contract_id: 'K07' },
  { key: 'H3', supplier_id: 'S01', ref: 'AF-77120', day: 9, item: 'Urea (46% N)', qty: 40, unit: 't', price: 890, docket: 'DK-4471', contract_id: 'K01' },
  { key: 'H4', supplier_id: 'S02', ref: 'FS-5521', day: 11, item: 'PKE', qty: 50, unit: 't', price: 395, docket: 'DK-51102', contract_id: 'K03' },
];

export const FARMS = [
  { farm_id: 'F01', name: 'Oreti Flats Dairy', slug: 'oreti-flats', farm_type: 'Dairy', location: 'Winton', area_ha: 386, manager_name: 'Callum Reid', manager_email: 'callum.reid@tussockridge.example', manager_phone: '+64210000103' },
  { farm_id: 'F02', name: 'Hillcrest Station', slug: 'hillcrest', farm_type: 'Sheep and beef', location: 'Gore', area_ha: 1240, manager_name: 'Fiona McLeod', manager_email: 'fiona.mcleod@tussockridge.example', manager_phone: '+64210000104' },
  { farm_id: 'F03', name: 'Mataura Valley Run-off', slug: 'mataura-run-off', farm_type: 'Support block', location: 'Mataura', area_ha: 212, manager_name: 'Tane Wiremu', manager_email: 'tane.wiremu@tussockridge.example', manager_phone: '+64210000105' },
];

// Who supplies each piece of evidence. A blank provider means the farm's own manager.
export const PROVIDERS = {
  gis: { name: 'Priya Chand', email: 'priya@southerngis.example', phone: '' },
  consultant: { name: 'Anna Lindqvist', email: 'anna@lindqvistenv.example', phone: '' },
  nutrient: { name: 'Mere Parata', email: 'mere@paddockplan.example', phone: '' },
  fert: { name: 'Josh Henare', email: 'josh@aparima-fert.example', phone: '+64210000108' },
  fencing: { name: 'Deane Walker', email: 'deane@deanefencing.example', phone: '+64210000109' },
  effluent: { name: 'Gareth Pullar', email: 'gareth@farmdairydesign.example', phone: '' },
  manager: null,
};

// An example checklist of evidence a certifier typically asks for. It is a setting, not law:
// confirm the real list with your certifier and add or change items from the console.
export const REQUIREMENTS = [
  { req_id: 'R01', short: 'farm-map', requirement: 'Farm map showing waterways, wetlands and paddocks', category: 'Maps', applies_to: 'All', provider: 'gis' },
  { req_id: 'R02', short: 'critical-source-areas', requirement: 'Critical source areas identified', category: 'Environment', applies_to: 'All', provider: 'consultant' },
  { req_id: 'R03', short: 'stock-numbers', requirement: 'Stock numbers by class, last 12 months', category: 'Stock', applies_to: 'All', provider: 'manager' },
  { req_id: 'R04', short: 'fertiliser-records', requirement: 'Fertiliser and nitrogen use records', category: 'Nutrients', applies_to: 'All', provider: 'fert' },
  { req_id: 'R05', short: 'nutrient-budget', requirement: 'Nutrient budget', category: 'Nutrients', applies_to: 'All', provider: 'nutrient' },
  { req_id: 'R06', short: 'effluent-consent', requirement: 'Effluent system description and discharge consent', category: 'Effluent', applies_to: 'Dairy', provider: 'effluent' },
  { req_id: 'R07', short: 'water-take-records', requirement: 'Water take consent and meter records', category: 'Water', applies_to: 'Dairy', provider: 'manager' },
  { req_id: 'R08', short: 'winter-grazing-plan', requirement: 'Winter grazing plan', category: 'Grazing', applies_to: 'All', provider: 'manager' },
  { req_id: 'R09', short: 'stock-exclusion-fencing', requirement: 'Stock exclusion: waterway fencing status', category: 'Stock', applies_to: 'All', provider: 'fencing' },
  { req_id: 'R10', short: 'risk-assessment', requirement: 'Farm environment risk assessment', category: 'Environment', applies_to: 'All', provider: 'consultant' },
];

// Where each farm's evidence starts on Monday morning. Anything not listed is already verified.
// `sent` is how many requests have gone out, `ago` is how many days ago the last one went.
export const EVIDENCE_START = {
  F01: { R05: 'received', R06: 'missing', R07: { s: 'requested', sent: 1, ago: 8 }, R08: 'missing' },
  F02: { R05: { s: 'requested', sent: 2, ago: 9 }, R09: 'missing' },
  F03: { R08: 'received' },
};

// Consents, certificates and other records with an expiry date. `days` is relative to the day you reset the demo.
export const REGISTER = [
  { reg_id: 'G01', farm_id: 'F01', kind: 'Consent', type: 'Water take consent (irrigation)', reference: 'DEMO-WT-0412', who: 'owner', days: 150, restriction: 'taking irrigation water' },
  { reg_id: 'G02', farm_id: 'F01', kind: 'Consent', type: 'Farm dairy effluent discharge consent', reference: 'DEMO-DE-0307', who: 'owner', days: 410, restriction: 'discharging effluent' },
  { reg_id: 'G03', farm_id: 'F02', kind: 'Consent', type: 'Water take consent (stock water)', reference: 'DEMO-WT-0588', who: 'owner', days: 520, restriction: 'taking stock water' },
  { reg_id: 'G04', farm_id: 'F01', kind: 'Certificate', type: 'Agrichemical handler certificate', reference: '', who: 'Jordan Ngata', days: -12, restriction: 'spraying' },
  { reg_id: 'G05', farm_id: 'F01', kind: 'Certificate', type: 'Agrichemical handler certificate', reference: '', who: 'Callum Reid', days: 19, restriction: 'spraying' },
  { reg_id: 'G06', farm_id: 'F01', kind: 'Certificate', type: 'Quad bike training', reference: '', who: 'Sam Whitaker', days: null, restriction: 'riding farm quad bikes' },
  { reg_id: 'G07', farm_id: 'F02', kind: 'Certificate', type: 'First aid certificate', reference: '', who: 'Fiona McLeod', days: 200, restriction: '' },
  { reg_id: 'G08', farm_id: 'F03', kind: 'Certificate', type: 'First aid certificate', reference: '', who: 'Tane Wiremu', days: 25, restriction: '' },
  { reg_id: 'G09', farm_id: 'F01', kind: 'Vehicle', type: 'Farm truck certificate of fitness (COF)', reference: 'Truck HX-1186', who: 'Callum Reid', days: 6, restriction: 'driving the farm truck on the road' },
  { reg_id: 'G10', farm_id: 'F01', kind: 'Certificate', type: 'Hazardous substances location compliance certificate', reference: 'Fuel and LPG store', who: 'Callum Reid', days: 300, restriction: 'storing fuel and LPG at the site' },
  { reg_id: 'G11', farm_id: '', kind: 'Insurance', type: 'Public liability insurance (certificate of currency)', reference: '', who: 'Aroha Tipene', days: 42, restriction: '' },
  { reg_id: 'G12', farm_id: 'F01', kind: 'Certificate', type: 'Heavy vehicle licence (Class 2)', reference: '', who: 'Jordan Ngata', days: 640, restriction: 'driving heavy vehicles' },
];

// People who hold certificates (everyone else in REGISTER.who is looked up from Config or here).
export const STAFF = {
  'Callum Reid': { email: 'callum.reid@tussockridge.example', phone: '+64210000103' },
  'Fiona McLeod': { email: 'fiona.mcleod@tussockridge.example', phone: '+64210000104' },
  'Tane Wiremu': { email: 'tane.wiremu@tussockridge.example', phone: '+64210000105' },
  'Jordan Ngata': { email: 'jordan.ngata@tussockridge.example', phone: '+64210000106' },
  'Sam Whitaker': { email: 'sam.whitaker@tussockridge.example', phone: '+64210000107' },
  'Aroha Tipene': { email: 'aroha.tipene@tussockridge.example', phone: '+64210000102' },
};
