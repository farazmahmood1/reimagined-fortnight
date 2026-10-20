# Forrof · Recruitment back-office automations (n8n demo)

Three automations for UK temp and contract recruitment agencies, running on a local n8n with fictional data for "Harbourline Recruitment":

| # | Automation | What it does | Runs |
|---|---|---|---|
| 1 | **Timesheets: chase → approve → payroll export** | Texts every temp with a missing timesheet a secure link to a 1-minute mobile form. Emails the client manager a one-click Approve / Query link and texts the temp when approved. Exports approved hours to a payroll and invoicing CSV (pay, charge, margin, PAYE or umbrella). | Mondays 09:00 (chase), Fridays 12:00 (export), or from the console |
| 2 | **Compliance documents: request → expiry alerts → verify** | Requests missing documents, warns temps 30 days before expiry, marks anyone with an expired document "do not book", collects uploads through a secure link and asks the consultant to verify. Writes each temp's compliance status back. | Daily 08:00, or from the console |
| 3 | **Umbrella evidence: monthly request → payslip checks** | Sends each umbrella company a monthly secure upload link. Checks every payslip line against approved hours (R1), hours × the assignment rate the agency paid (R2), the National Living Wage (R3) and non-taxable payments (R4). Records every check and flags anything to review. | 1st of the month 09:00, or from the console |

Hiring decisions are never automated. Compliance flags are prompts for a human to review, not decisions.

## Run it

```powershell
cd "D:\Software Development\automations\n8n"
npm start
```

Leave that window open, then go to:

- **Demo console:** http://localhost:5678/webhook/console
- **n8n editor:** http://localhost:5678. The login is in `LOGIN.local.txt`.

Stop n8n with **Ctrl+C** in its window.

Other commands, each run in a second window:

| Command | When |
|---|---|
| `npm run reset-demo` | Back to the Monday-morning starting point (same as the **Reset demo data** button) |
| `npm run test-flows` | End-to-end test of every flow through its real webhooks (53 checks). Resets the data before and after. |
| `npm run setup` | Only after changing anything in `src/` or `scripts/`: stop n8n first, then run it to rebuild, re-import and re-publish the workflows |

The demo data is relative to the day you reset. It's always last week's timesheets, a right to work expiring in 14 days, a forklift licence that expired 12 days ago, and last month's umbrella evidence. The story works whenever you record it.

## 3-minute demo script (for the LinkedIn video or a sales call)

1. **Console, top.** "This is a temp desk on Monday morning: 4 timesheets missing, 1 waiting for the client, 3 approved."
2. Click **1 · Run Monday timesheet chase**. The outbox shows an SMS to each temp with a missing timesheet, an approval reminder to the client manager and a summary for the consultant.
3. Click **Temp's link** next to Aisha Khan. The mobile form opens. Tick "I confirm" and submit.
4. Back on the console, click **Client's approval link** for Aisha and then **Approve**. The outbox now shows Aisha's "approved" SMS.
5. Click **2 · Run payroll export**, then **Download CSV**. It shows pay, charge, margin and the PAYE or umbrella route per worker.
6. Click **3 · Run document check**:
   - Samuel Okoro becomes "Do not book" because his forklift licence has expired.
   - Marek Nowak's right to work expires in 14 days.
   - Ryan Patel's food hygiene certificate is missing.

   Each gets an SMS with an upload link, and the consultant gets one summary email.
7. Open Ryan's **Upload link** and upload `demo-files/sample-food-hygiene-certificate-ryan-patel.pdf`. Back on the console, click **View file**, then **Mark verified**.
8. Click **4 · Request umbrella evidence**:
   - Open Northstar's upload link and upload `demo-files/northstar-umbrella-payslips.csv`. Samuel's assignment income is £180 short and gets flagged.
   - Repeat with Clearwater and `demo-files/clearwater-umbrella-payslips.csv`. Hannah's £320 non-taxable payment gets flagged.
9. Switch to the n8n editor and open **1 · Timesheets**. Each boxed lane is one step, read left to right. Close with: "It runs inside the systems you already use. This demo uses tables; in your agency it connects to your ATS and payroll."

## 4 · Inbox triage (real Forrof inbox)

**Page:** http://localhost:5678/webhook/applications (add `?demo=1` to hide names and emails for recordings).

- Reads the Hostinger inbox **read-only** through the "IMAP account" credential: nothing is marked read, moved or sent. Its first run went back to 1 June 2026 (`INBOX_SINCE` in `scripts/build-workflows.mjs`); after that it picks up new mail as it arrives.
- Picks out job applications with keyword rules (no AI), matches each to a role, and reads the CV text locally (PDF and Word). CV files are kept in `files/applications/`.
- **AI runs only when you click "Summarise"** on the page, one batch at a time, and only while it is switched on (top of the page). For each CV it sends the role checklist and the CV text (cut to 6,000 characters) to OpenAI through the "OpenAI account" credential, with `store: false`. It returns a short summary, met / missing / unclear for each must-have, and questions to ask. **It doesn't score, rank or reject anyone**; the Shortlist / Not now buttons are for people.
- Roles and their must-haves live in the **Triage roles** table and settings (model, batch size, AI on/off) in **Triage settings**. Edit them in n8n under Overview → Data tables. "Reset demo data" never touches these tables.
- **Sample workspace for demos:** http://localhost:5678/webhook/applications?demo=1 (or the eye icon). A fictional UK agency, "Harbourline Recruitment", with dashboard, jobs and clients, kanban pipelines, talent-pool re-matching, right-to-work and compliance documents, client-ready shortlists (print to PDF), interview scheduling, team notes, WhatsApp/SMS with simulated replies, an outbox and source tracking. It runs entirely in the browser (`src/inbox-sample.client.js`), uses no API and never touches the real tables. n8n serves the page sandboxed, so it starts fresh on every reload.
- First-time setup on a new machine: add the IMAP and OpenAI credentials in n8n, run `npm run setup`, start n8n, then `curl -X POST http://localhost:5678/webhook/applications/setup`.

## How it's built

- **7 workflows** (generated into `workflows/` by `scripts/build-workflows.mjs` from the logic in `src/`):
  - the three automations;
  - **Demo console**: the web page and its buttons;
  - **Demo · Reset data**: creates the tables on first run and loads the demo data;
  - **Shared · Load data**: reads all tables in one go;
  - **Shared · Send message**: the only workflow that sends anything.
- **Data tables** (built into n8n) stand in for the agency's ATS and payroll: Config, Clients, Umbrellas, Temps, Timesheets, Documents, Evidence, Payslip checks, Outbox and Exports. You can browse them in the n8n editor under Overview → Data tables.
- **Demo mode** logs every SMS and email to the Outbox table. To send for real:
  1. In n8n, add your own Twilio and SMTP credentials.
  2. Open **Shared · Send message** and enable the two grey nodes.
  3. Set the sender number and address.
  4. Set `sms_enabled` / `email_enabled` to `true` in the Config table.

  Never paste credentials into chat or into the workflow files.
- **Files** go under `files/` (documents, umbrella CSVs, payroll exports). n8n is only allowed to read and write inside that folder.
- **Links** use random 36-character tokens. Each link works only for its own timesheet, document or evidence request. Download links accept only exact export file names.

## Adapting it for a real agency

Replace **Shared · Load data** and the "Update …" / "Record …" nodes with the agency's ATS or payroll API, or a nightly CSV export if it has no API. Keep the logic in `src/` and the Send message workflow. Before going live, confirm the umbrella evidence rules with the agency's compliance adviser.

## Notes

- n8n 2.43.4 on Node 24, with a SQLite database in `data/`. Telemetry and update checks are switched off.
- Times are shown in UK time. Calendar dates are timezone-proof, because this PC's own clock is set to UTC−4.
- n8n is licensed under the Sustainable Use License: you may build and run workflows for clients, but not resell or white-label n8n itself.
- `data/`, `files/` and `LOGIN.local.txt` are local only (see `.gitignore`).
