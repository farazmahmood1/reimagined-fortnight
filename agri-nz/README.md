# Forrof · Farm admin agent for New Zealand agribusiness (n8n demo)

An AI-agent-style assistant with guardrails for the paperwork on a farm or in a farm supply business. It runs on a local n8n with fictional data for "Tussock Ridge Farming Ltd", a made-up Southland farming company with three properties.

The rule behind every automation: **the agent does the dull parts, a person signs off anything that is sent or paid, and every step is logged.**

| # | Automation | The agent does alone | A person decides | Runs |
|---|---|---|---|---|
| 1 | **Supplier invoices: check → approve → payment file** | Reads each invoice, matches it to its contract and delivery docket, runs seven checks (contract, price, volume, delivery docket, GST, duplicate, bank account), sends each approver one list, and prepares one bank file. | Approving every invoice. The owner decides anything over $2,500 and everything flagged. Approving a flagged invoice needs a written reason. Sending a question to a supplier needs a click. Paying: the agent has no bank access. | Weekdays 07:30 (check), 18th of the month 09:00 (payment file), or from the console |
| 2 | **Farm plan evidence: chase → verify → sign off** | Asks each provider for what is missing (SMS or email, secure upload link, no login), reminds after 7 days, stops at 3 requests so a person can phone, and drafts the evidence pack from verified records. | Verifying each upload (or sending it back with a reason), signing off the pack, and with that, sending it to the certifier. | Mondays 08:00, or from the console |
| 3 | **Consents and certificates: watch → remind → verify** | Works out where every consent, certificate, vehicle check and insurance date stands, reminds the person responsible on a tightening schedule, and tells the operations manager what not to assign until it is sorted. | Verifying each renewal, and recording that a consent renewal was lodged. | Daily 07:00, or from the console |

The agent only checks, drafts, chases and flags. It never approves an invoice, pays anyone, signs a pack, or changes a record a person has verified.

## The problem it solves

New Zealand farms run a small business's worth of paperwork with no office staff. Three jobs cause most of the pain:

- **Time.** Fonterra's Farm Source estimates farmers spend about 10 hours a week on admin, with compliance the biggest task, and has set itself a target of saving its 8,200 farms a million hours. Regulation and compliance stays in the top three worries in every Federated Farmers confidence survey (23% in July 2026).
- **Deadlines that keep moving.** About 2,500 to 3,400 Southland farms need a certified freshwater farm plan. The due date moved from 27 May 2026 to the end of November 2027, and the national system is being simplified. Consents have their own clock: lodge a renewal at least 6 months before expiry or the council decides whether you may keep operating (RMA s124). Staff certificates (agrichemical, quad bike, first aid) and vehicle COFs expire quietly.
- **Money leaking out of invoices.** Prices creep over the contract, deliveries come up short of the docket, the same invoice arrives twice, and invoice-redirection fraud (a "new" bank account on a familiar supplier's invoice) targets exactly this kind of business. Banks advise phoning the supplier on a number you already have.

The answer in one line: **an agent that does the checking and chasing, and stops wherever a person has to say yes.** Farmers don't want another app to learn, so the people being chased get a text with a link (no login), and the farm sees one page that says what's done, what's waiting for them, and what's on record.

Sources: [Fonterra Farm Source, simplifying compliance](https://nzfarmsource.co.nz/your-co-operative/simplifying-compliance.html); [Federated Farmers confidence survey, Rural News, Sept 2026](https://ruralnewsgroup.co.nz/dairy-news/dairy-general-news/federated-farmers-confidence-survey-profit-downturn-concerns); [Southland farm plan extension, Rural News, May 2026](https://www.ruralnewsgroup.co.nz/dairy-news/dairy-general-news/southland-freshwater-farm-plan-extension); [Ministry for the Environment briefing](https://environment.govt.nz/assets/publications/26-BRF-01315-MCERT.pdf); [NatWest on invoice fraud against farms](https://www.farminguk.com/News/Bank-warns-farmers-losing-thousands-to-invoice-scammers_47018.html). Check the figures again before quoting them publicly.

## The console at a glance

One page, five tabs, written for a farmer rather than an accountant:

- **Today:** "Good morning. 6 things need a person." Then the three zones (done by the agent alone, waiting for a person's yes, every step logged), the list of what's waiting grouped by kind with one button each, the three jobs the agent looks after, and how it works with its guardrails.
- **Invoices, Farm plan, Consents and certificates:** each opens with one plain sentence about what the agent does there and the buttons to run it, then the numbers, then the full list.
- **History:** the audit trail with filters and every message the agent sent.

Approvers, contractors and the certifier get the same look on their own pages (approve an invoice, upload a file, sign off a pack). The design lives in `src/console.css` and the `THEME` in `src/shared.js`; it loads the Figtree font from Google Fonts and falls back to the system font offline. It works down to phone width.

## Run it

```powershell
cd "D:\Software Development\automations\n8n\agri-nz"
npm start
```

n8n needs about 30 seconds to be ready: for the first few seconds nothing answers, then the console shows a 404 until n8n has switched its workflows on. Wait for the window to print **✓ Ready**, then leave it open and go to:

- **Demo console:** http://localhost:5680/webhook/console
- **n8n editor:** http://localhost:5680. The login is in `LOGIN.local.txt`.

This demo uses the n8n installed one folder up and has its own data, login and ports (5680 and 5681), so it can run **at the same time** as the recruitment demo (5678). Stop n8n with **Ctrl+C** in its window.

Other commands, each run in a second window:

| Command | When |
|---|---|
| `npm run reset-demo` | Back to the Monday-morning starting point (same as the **Reset demo** button at the top right of the console) |
| `npm run test-rules` | Fast checks of the business rules, the chase, the watch and every console tab, no n8n needed (72 checks) |
| `npm run test-flows` | End-to-end test of every flow through its real webhooks (164 checks), including attempts to get round the guardrails. Resets the data before and after. |
| `npm run update` | After changing anything in `src/` or `scripts/`, with n8n running: rebuilds the workflows and pushes them into n8n in seconds |
| `npm run setup` | First install, or when a data table's columns change: stop n8n first, then run it to rebuild, re-import and re-publish everything (takes several minutes) |
| `npm run demo-files` | Rewrites the sample PDFs in `demo-files/` |

From the folder above you can also run `npm run agri:start`, `agri:setup`, `agri:update`, `agri:reset-demo`, `agri:test-rules` and `agri:test-flows`.

The demo data is worked out from today in New Zealand time: invoices are always due on the next 20th, the consents are always the same number of days from expiring. The story works whenever you record it.

## 4-minute demo script (for the LinkedIn video or a call)

The console opens on **Today**: "Good morning. 6 things need a person." Under it are three zones: what the agent did alone, what is waiting for a person's yes (the big lime number), and every step logged. Start here and let the page explain itself: "This is the farm office. The agent does the checking and chasing. These six are the calls only a person can make."

**1 · Invoices (the money one)**

1. **Invoices** tab. "Monday morning: nine invoices came in by email. Nobody has touched them."
2. Click **Check new invoices**. "Five are clean, four are flagged. $17,213 is held back for a human look."
3. Click **Open decision** next to the Invercargill Fuel invoice. "Same diesel invoice we've paid for years. This time the bank account is different: that's how invoice-redirection fraud works. The agent doesn't pay. It tells the owner to phone the supplier on a number they already have."
4. Click **Send this to Dale Hutchins**. "The agent drafted the question. Nothing goes out until the owner clicks. And look: the draft never reveals the account we hold on file."
5. Open the Fiordland Stockfeeds invoice: "30 tonnes invoiced, the signed docket says 27.5 delivered." Use **Approve anyway**, and show the reason is required.
6. Back on the console: approve the clean ones from the owner's and the operations manager's lists. Click **Build payment file**, then **Download CSV**. "Nothing has been paid. The agent has no bank access. It made the file; a person uploads it. And every payee is the account on file."
7. **Add an invoice**, click **Price 10% over the contract**, add it, and run **Check new invoices** again. "You can try to break it."

**2 · Farm plan evidence (the deadline one)**

8. **Farm plan** tab. "Three farms, 26 pieces of evidence, due 27 November 2027." Click **Chase missing evidence**. "Consultants get an email, contractors get an SMS with a link. They upload from the ute. It stops after three requests so a person can phone."
9. Under Oreti Flats Dairy, on the **Winter grazing plan** row, click **Open the link sent to Callum** (the page the agent texted him), upload `demo-files/sample-winter-grazing-plan-oreti-flats.pdf`. Back on the console, **Mark verified** (or **Send it back** with a reason).
10. On **Today**, under **Uploads to check**, **Mark verified** on the Mataura Valley winter grazing plan. "That was the last item. The agent drafts the evidence pack, built only from verified records, and asks the owner to sign."
11. Click **Review and sign off**, type Hamish Gordon, tick the box, sign. "Only now does anything go to the certifier. Who signed and when is on the record."
12. Scroll to **The rules keep moving**. Change the due date. "The government moved this date by 18 months. One setting; every countdown follows." Then add a requirement. "A new requirement lands on every farm and reopens the pack that was already signed. Nothing is lost."

**3 · Consents and certificates (the "I didn't know" one)**

13. **Consents and certificates** tab, then **Check every expiry date**. "The irrigation consent is five months from expiry. Under the Resource Management Act, lodging six or more months ahead lets you keep operating while the council decides; between three and six months, the council decides; later, you stop. The agent tells the owner which window they are in."
14. "Jordan's agrichemical certificate expired 12 days ago. The operations manager gets a message: don't assign spraying until it is sorted."

**4 · The record**

15. **History** tab. "Every step, who did it, and when. Agent or person. Download it as a CSV." Close on **How it works** at the bottom of **Today**: the three steps and the two lists of what the agent does alone and what only a person can do.
16. Switch to the n8n editor and open **1 · Supplier invoices**. Each boxed lane is one step, read left to right. "It runs inside the systems you already use. This demo uses tables; in your business it connects to Xero, your inbox and your document store."

## What the seven invoice checks look at

| Check | Flags when |
|---|---|
| Matches a contract | No contract covers the item, or it was not in force on the invoice date |
| Price | The unit price is more than 2% over the contract price (or the unit differs). The tolerance is a setting. |
| Volume | The invoice takes the contract past the quantity agreed. Paid and approved invoices count towards it. |
| Delivery docket | The docket is missing or unknown, shows less than was invoiced, or was already invoiced on another invoice |
| Arithmetic and GST | Net, GST (15%) or the total does not add up |
| Duplicate | The same supplier invoice number, or the same amount on the same date, was already received |
| Bank account | The account on the invoice is not the one on file. Payments always use the account on file. |

Clean invoices go to the operations manager up to $2,500 (including GST) and to the owner above that. Everything flagged goes to the owner. Each invoice gets its own random review link, and each approver gets one list rather than one message per invoice.

## Dates and rules: settings, not law

The deadlines and renewal windows are in the **Config** table (n8n → Overview → Data tables), because the rules are being changed. Confirm them with your own adviser before relying on them.

- **Southland freshwater farm plans:** the due date for certified plans moved from 27 May 2026 to 27 November 2027 (Ministry for the Environment, May 2026). The freshwater farm plan system is also being simplified (announcements in August 2026), so treat the evidence checklist as an example and confirm what a plan needs with your certifier. The evidence pack is not the plan itself.
- **Consent renewals (Resource Management Act, section 124):** lodge a renewal at least 6 months before expiry and you may keep operating until the council decides. Lodge 3 to 6 months before and the council decides whether you may. Lodge later and you must stop when the consent expires. A Duration of Consents Amendment Bill that would extend some consents was before Parliament when this was built, so the months are settings.
- **Payment terms:** the 20th of the month following the invoice date is a common New Zealand term. The pay day is a setting. GST is 15%.

## How it's built

- **7 workflows** (generated into `workflows/` by `scripts/build-workflows.mjs` from the logic in `src/`):
  - the three automations;
  - **Demo console**: the web page and its buttons;
  - **Demo · Reset data**: creates the tables on first run and loads the demo data;
  - **Shared · Load data**: reads all tables in one go;
  - **Shared · Send message**: the only workflow that sends anything.
- **Data tables** (built into n8n) stand in for Xero, the farm software, the inbox and the document store: Config, Suppliers, Contracts, Dockets, Invoices, Payment runs, Farms, Requirements, Evidence, Register, Outbox and **Audit log**. Browse them under Overview → Data tables.
- **Every step is logged** to the Audit log table: who (agent or a named person), what, to what, and when. The console shows it, filters it, and downloads it as a CSV.
- **Demo mode** logs every SMS and email to the Outbox table. To send for real:
  1. In n8n, add your own Twilio and SMTP credentials.
  2. Open **Shared · Send message** and enable the two grey nodes.
  3. Set the sender number and address.
  4. Set `sms_enabled` / `email_enabled` to `true` in the Config table.

  Messages to the fictional demo addresses (`+64 21 000 xxxx` and `*.example`) are **never delivered**, even when live sending is on. Never paste credentials into chat or into the workflow files.
- **Files** go under `files/` (evidence, certificates, payment files). n8n is only allowed to read and write inside that folder.
- **Links** use random 36-character tokens. Each link works only for its own invoice, upload, pack or sign-off. File links accept only exact names or a matching pack token.
- **Invoices** are typed in with the **Add an invoice** form in this demo. In a real business they are read from the invoice inbox (an email trigger and a reading step) or pulled from Xero bills; the checks, the approvals and the log stay the same.

## Adapting it for a real farm or supply business

Replace **Shared · Load data** and the "Update …" / "Add …" / "Log …" nodes with the business's own systems: Xero or MYOB for bills and suppliers, the farm software for stock and records, a shared drive for documents, a shared inbox for invoices. Keep the logic in `src/` and the Send message workflow. Before going live, confirm the checklist, the renewal timings and the approval limits with the business's adviser.

## Notes

- n8n 2.43.4 on Node 24, with a SQLite database in `data/`. Telemetry and update checks are switched off.
- Times are shown in New Zealand time. Calendar dates are timezone-proof, because this PC's own clock is set to UTC−4.
- There is no official fictional phone range in New Zealand, so demo numbers are `+64 21 000 xxxx` and the send workflow refuses to deliver to them.
- n8n is licensed under the Sustainable Use License: you may build and run workflows for clients, but not resell or white-label n8n itself.
- The console and its buttons are not password-protected. Run the demo on this PC only and do not expose port 5680 to the internet.
- `data/`, `files/` and `LOGIN.local.txt` are local only (see the `.gitignore` in the folder above).
