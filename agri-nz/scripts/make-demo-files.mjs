// Writes small, valid PDFs into demo-files/: placeholders that the seeded records point at, and sample documents
// to upload on camera. Run: npm run demo-files   (setup runs it when a file is missing). Plain ASCII only.
import fs from 'node:fs';
import path from 'node:path';
import { DEMO_FILES_DIR } from './env.mjs';

const esc = (s) => String(s).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');

function makePdf({ title, subtitle = '', lines = [] }) {
  const content = [
    '0.055 0.227 0.208 rg 0 760 595 82 re f',
    `BT /F2 22 Tf 1 1 1 rg 50 802 Td (${esc(title)}) Tj ET`,
    subtitle ? `BT /F1 11 Tf 0.72 0.83 0.80 rg 50 779 Td (${esc(subtitle)}) Tj ET` : '',
  ];
  let y = 720;
  for (const line of lines) {
    const head = line.startsWith('## ');
    const text = head ? line.slice(3) : line;
    if (text) content.push(`BT /${head ? 'F2' : 'F1'} ${head ? 13 : 11} Tf 0.08 0.14 0.12 rg 50 ${y} Td (${esc(text)}) Tj ET`);
    y -= head ? 26 : 17;
  }
  content.push(`BT /F1 9 Tf 0.4 0.45 0.43 rg 50 40 Td (${esc('Sample file for the Forrof demo. Fictional data: Tussock Ridge Farming Ltd.')}) Tj ET`);
  const stream = content.filter(Boolean).join('\n');
  const objs = [
    null,
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> >>',
    `<< /Length ${Buffer.byteLength(stream, 'latin1')} >>\nstream\n${stream}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>',
  ];
  let out = '%PDF-1.4\n';
  const offsets = [];
  for (let i = 1; i < objs.length; i++) {
    offsets[i] = Buffer.byteLength(out, 'latin1');
    out += `${i} 0 obj\n${objs[i]}\nendobj\n`;
  }
  const xref = Buffer.byteLength(out, 'latin1');
  out += `xref\n0 ${objs.length}\n0000000000 65535 f \n${offsets.slice(1).map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Size ${objs.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out, 'latin1');
}

const FILES = {
  'seed-sample-evidence.pdf': { title: 'Sample evidence document', subtitle: 'Demo data', lines: ['## This stands in for the real file', 'In your business this is the farm map, nutrient budget, stock records or fertiliser', 'records that a provider uploaded. The demo points every seeded record at this page.'] },
  'seed-sample-certificate.pdf': { title: 'Sample certificate', subtitle: 'Demo data', lines: ['## This stands in for the real certificate', 'In your business this is the consent, certificate of fitness, training certificate or', 'certificate of currency that was verified and filed against the record.'] },
  'sample-effluent-consent-oreti-flats.pdf': { title: 'Effluent system and discharge consent', subtitle: 'Oreti Flats Dairy', lines: ['## System description', 'Two-pond system with a weeping wall and low-rate irrigation to 62 ha.', 'Storage: 2,400 cubic metres. Last inspected by Farm Dairy Design.', '', '## Discharge consent', 'Reference: DEMO-DE-0307. Held by Tussock Ridge Farming Ltd.', 'Conditions attached. Renewal details are in the consents register.'] },
  'sample-winter-grazing-plan-oreti-flats.pdf': { title: 'Winter grazing plan', subtitle: 'Oreti Flats Dairy', lines: ['## Paddocks and crops', 'Fodder beet: paddocks 14 and 15 (22 ha). Kale: paddock 9 (11 ha).', 'Critical source areas fenced and left ungrazed.', '', '## Stock', 'Mixed-age cows moved on 10 June, back by 5 August.', 'Break-feeding from the top of the slope, away from waterways.'] },
  'sample-water-take-records-oreti-flats.pdf': { title: 'Water take consent and meter records', subtitle: 'Oreti Flats Dairy', lines: ['## Consent', 'Reference: DEMO-WT-0412. Irrigation take from the Oreti catchment.', '', '## Meter records', 'Meter read monthly through the irrigation season.', 'All readings are within the consented daily and annual volumes.'] },
  'sample-nutrient-budget-hillcrest.pdf': { title: 'Nutrient budget', subtitle: 'Hillcrest Station', lines: ['## Summary', 'Prepared by Paddock Plan Consulting for the year just ended.', 'Nitrogen loss per hectare is within the farm\'s modelled range.', '', '## Inputs', 'Fertiliser: 18 kg N per hectare on 640 ha. Supplementary feed: baleage only.'] },
  'sample-stock-exclusion-fencing-hillcrest.pdf': { title: 'Stock exclusion: waterway fencing status', subtitle: 'Hillcrest Station', lines: ['## Status', '31.4 km of waterway fenced. 2.1 km still to fence on the eastern boundary.', 'Planned for completion before the next winter.', '', '## Prepared by', 'Deane Fencing, site visit and GPS survey.'] },
  'sample-agrichemical-certificate-jordan-ngata.pdf': { title: 'Agrichemical handler certificate', subtitle: 'Renewal', lines: ['## Certificate holder', 'Jordan Ngata, Oreti Flats Dairy.', '', '## Details', 'Competency: agrichemical handling and application.', 'Valid for five years from the date of issue.'] },
  'sample-quad-bike-training-sam-whitaker.pdf': { title: 'Quad bike training certificate', subtitle: 'Sam Whitaker', lines: ['## Certificate holder', 'Sam Whitaker, relief milker, Oreti Flats Dairy.', '', '## Details', 'Completed a recognised quad bike rider course, including slope and load handling.', 'Valid for three years from the date of issue.'] },
  'sample-first-aid-certificate-tane-wiremu.pdf': { title: 'First aid certificate', subtitle: 'Tane Wiremu', lines: ['## Certificate holder', 'Tane Wiremu, Mataura Valley Run-off.', '', '## Details', 'Workplace first aid, including CPR and managing serious bleeding.', 'Valid for two years from the date of issue.'] },
  'sample-truck-cof-hx-1186.pdf': { title: 'Certificate of fitness', subtitle: 'Farm truck HX-1186', lines: ['## Vehicle', 'Truck HX-1186, Oreti Flats Dairy.', '', '## Result', 'Passed. Next inspection due in six months.', 'Brakes, tyres, lights and load restraint checked.'] },
};

fs.mkdirSync(DEMO_FILES_DIR, { recursive: true });
let written = 0;
for (const [name, spec] of Object.entries(FILES)) {
  const file = path.join(DEMO_FILES_DIR, name);
  if (fs.existsSync(file) && !process.argv.includes('--force')) continue;
  fs.writeFileSync(file, makePdf(spec));
  written++;
}
console.log(`Demo files ready in ${DEMO_FILES_DIR} (${written} written, ${Object.keys(FILES).length - written} already there).`);
