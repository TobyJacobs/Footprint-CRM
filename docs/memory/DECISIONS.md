# Decisions log

Every important decision, dated, with the reason. Never delete entries — if a decision changes, add a new entry that replaces it and say which one it replaces.

---

## 29 September 2026 — Keep Claude's memory inside the repository
**Decision:** Claude's memory lives in `docs/memory/` and is pushed to GitHub.
**Why:** It's backed up automatically, has full history, and isn't lost if a computer or chat session is.

## 29 September 2026 — Your Lead Kit stays on GoHighLevel
**Decision:** The client-facing Your Lead Kit product stays on white-label GoHighLevel. The new platform only replaces Footprint's own internal use of GoHighLevel.
**Why:** Rebuilding a paid product that clients log in to is a far bigger, riskier job, and not what the business needs first.

## 29 September 2026 — Xero stays as the accounts system
**Decision:** Xero remains the accounting system (bank feeds, VAT/HMRC, reporting). The new platform replaces Zoho Books' quoting, orders, purchase orders, invoicing and subscription billing, and sends invoices to Xero as Zoho does today.
**Why:** That's how the business works now. Building accounting and HMRC filing ourselves would add risk and cost for no gain.

## 29 September 2026 — Team chat stays outside the platform
**Decision:** Zoho Cliq will be replaced by Microsoft Teams, not a chat built into the platform.
**Why:** Building a good real-time messenger is a lot of work for little gain. Teams is proven and the owner is happy to use it.

## 29 September 2026 — Users, teams and roles are configurable, not hard-coded
**Decision:** Wave 0 builds the framework for users, teams, roles and permissions. Admins add real people and teams later through an admin screen.
**Why:** The owner's request. It lets the organisation change without code changes.

## 29 September 2026 — Use a proven password manager instead of building a vault
**Decision:** Zoho Vault is replaced by an off-the-shelf password manager (e.g. 1Password or Bitwarden), not built into the platform.
**Why:** A bespoke password vault is very high risk. Proven products are audited, cheap (about £3–£7 per person a month) and reliable. Owner agreed.

## 29 September 2026 — Staff sign in with Microsoft 365
**Decision:** Staff log in using their existing Microsoft 365 work accounts.
**Why:** Footprint already uses Microsoft 365. One login for everything, and leavers lose access automatically when their Microsoft account is closed.

## 29 September 2026 — Distributor management is a later stage
**Decision:** Forget Me Not distributor management (details, routes, pay, GPS) is a possible later stage. Round Control is being rolled out for it now.
**Why:** It's already covered by a tool being adopted. The owner likes the idea of absorbing it later.

## 29 September 2026 — One navigation section per feature
**Decision:** Each distinct feature (e.g. Customers, Quotes & Invoices, Projects, Design Workload, Magazines) has its own place in the main navigation. The design workload tool lives inside the platform. Users only see the sections their role allows.
**Why:** The owner's request. It keeps the platform easy to find your way around.

## 29 September 2026 — Technical foundations
**Decision:**
- **App:** Next.js (TypeScript), hosted on **Netlify** with automatic deploys from GitHub and preview links for every change.
- **Database, file storage and login:** **Supabase**, London region.
  - Staff sign in with **Microsoft 365**.
  - Customer portal users sign in by email with two-step codes.
  - Permissions are enforced inside the database (row-level security).
  - The audit log is recorded by the database.
  - Daily and point-in-time backups.
- **Email:** **Postmark** (or Resend) for quotes, invoices and notifications, logged against the customer.
- **Payments:** **Stripe** (card) and **GoCardless** (Direct Debit). Card details are never stored by us.
- **Accounts:** send invoices to **Xero** through its official connection.

**Why:** Well-known, well-supported tools that will be maintainable for years. The owner already uses Supabase and Netlify. Data stays in the UK. Estimated running cost is about £150–£350 a month, against about £2,500 today.

**Alternatives rejected:**
- **Plain HTML + Supabase:** too hard to keep consistent at this size.
- **Low-code builders:** per-user cost, less control, not truly owned.

Owner agreed on 29 September 2026.

## 29 September 2026 — Roadmap reordered: Zoho first, Quote to Invoice priority
**Decision:** The waves are:
- 0 Foundations
- 1 Customers (lean)
- 2 Quote to Invoice
- 3 Projects, Time and Dashboards (Zoho One switched off)
- 4 Design Workload
- then Magazines, Portal, Reporting and Marketing as before

This replaces Claude's draft proposal of Design Workload as Wave 1.

**Why:** The owner wants the Zoho features — mainly quote to invoice — first. Customers must come before quotes because every quote belongs to a customer.

## 29 September 2026 — Separate "Footprint Group" organisation in Supabase
**Decision:** The platform's Supabase projects (test and live, London) live in a separate **Footprint Group** organisation inside the owner's existing Supabase account.
- Start on the **Free** plan.
- Upgrade to **Pro** (about £20 a month) before any real customer data goes in, with the owner's approval.

**Why:** It keeps the business's data, billing and access separate from the owner's other projects, and makes it easy to hand over or add colleagues.

## 1 October 2026 — Wave 1 scope: customers, contacts, hosting plans, retainers
**Decision:**
- Customers get the core Zoho fields plus Footprint's own: credit status, Direct Debit statuses, services, payment terms, Xero ID, how they heard about us, and status.
- Leftovers from old integrations are dropped: WorkflowMax, Zoom webinar stats, SalesIQ visit stats, and unused "Option 1/2" lists.
- Wave 1 also includes **hosting plans** (with web and email hosting details) and **digital retainers** (with monthly services) on each customer.
- **Zoho Billing subscriptions** move in **Wave 2**, together with billing.
- Picklist options are kept as the same wording as Zoho, so the import is simple. They're checked in the app rather than locked into the database, so new options don't need a database change.

**Why:** These are the owner's choices (29 September and 1 October 2026). See `docs/discovery/ZOHO-CRM.md`.

## 1 October 2026 — Wave 2c order and email provider
**Decision:**
- **Order:**
  1. recurring billing (no outside accounts needed)
  2. emailing
  3. card payments
  4. Direct Debit
  5. Xero sync
- **Email goes through Postmark**, built first against Postmark's test mode. The owner signs up and adds the footprintgroup.uk DNS records before real sending.
- The owner has a **Xero** account. They do **not** currently have Stripe or GoCardless accounts (see OPEN-QUESTIONS).
- **Recurring invoices run inside the database** on a daily schedule (Supabase pg_cron), so no secret keys are needed. Admins can also run them on demand.

**Why:** The owner's choices on 1 October 2026. Recurring billing replaces Zoho Billing / Zoho Books recurring invoices and works without any new accounts.

## 1 October 2026 — Netlify visibility: live site public, previews private
**Decision:** Netlify "Team protection" changed from "production and previews" to **previews only**. The live site (footprinthub.netlify.app) opens normally. Our own Microsoft sign-in protects every page except `/login` and customers' private quote links (`/q/…`). Deploy previews still need a Netlify team login.

**Why:** The owner's director needs to see the demo without a Netlify account, and customers must be able to open quote approval links. The platform's own login and database rules are the real protection. Owner approved.

## 1 October 2026 — Wave 2 approach
**Decision:**
- **Build order:**
  - **2a:** products, quotes (with gross profit and online approval), sales orders, invoices, printable documents
  - **2b:** purchase orders and credit notes
  - **2c:** emailing (Postmark), payments (Stripe, GoCardless), Xero sync, subscription billing (these need test accounts)
- **Quote approval** uses a private secure link. The customer types their name (and optional PO number) and clicks Accept or Decline. We record who, when and their IP address. No login needed.
- **Custom fields kept and tidied:**
  - kept: Probability, Business Unit, Expected Order/Invoice Date, Delivery Type, Reason for Loss, Labour Cost, GP, Deadline, Copy Shop flags, Collected, and the sales order production steps
  - Zoho's multi-select "Quote Stage" is replaced by clear statuses: Draft → Sent → Accepted / Declined → Converted
- Numbering continues Zoho's series (QT-, SO-, INV-, PO-, CN-) from the next numbers at cut-over.
- Every line has a cost as well as a price, so gross profit is shown.

**Why:** The owner's choices. See `docs/discovery/ZOHO-BOOKS.md`.

## 1 October 2026 — Live database and real data on hold until the final wave
**Decision:**
- The live London Supabase project (Pro plan, about £20 a month) is **on hold** until the owner has shown the project to their director, and won't be created before the last wave.
- Until then, everything is built and demonstrated on the **test** database with **made-up data only**.
- The Zoho import tool is still built and tested, but against **made-up files in Zoho's export format**. The real import, the nightly Zoho copy, and switching off old tools all happen at the end.

**Why:** The owner wants director sign-off before spending money or moving real customer data.

**Consequence:** No old tool (Zoho, monday.com, Mag Manager) is switched off until the live database exists and real data has moved. The roadmap's "switch off" steps move to a final cut-over stage.

## 1 October 2026 — How GDPR requests work in the platform
**Decision:**
- Exporting and erasing personal data are **admin-only**.
- Erasure **anonymises rather than deletes**: the record stays as "Removed (GDPR)", so links and history still work.
- The person's data is also **redacted from the audit log**. The log keeps only the record id and a "GDPR erasure" event (who and when).
- Erased records carry `erased_at`, so imports and syncs skip them.
- Records kept by law (e.g. invoices for 6 years, from Wave 2) are out of scope for erasure.

**Why:** Meets UK GDPR rights of access and erasure without breaking history. An audit log that kept erased data would defeat the erasure. Process is in `docs/runbooks/GDPR-REQUESTS.md`.

## 1 October 2026 — Third-party passwords are not migrated
**Decision:** The plain-text "3rd Party Password" values in Zoho's Web Hosting Plans are **never** copied into the platform. They move to the password manager. Each hosting plan keeps the username and a note saying where the login is stored.

**Why:** Storing passwords in a CRM is a security and GDPR risk. The password manager exists for this. Owner agreed.

## 1 October 2026 — Sentry (EU region) for error alerts
**Decision:**
- Use Sentry's free plan in its **EU (Frankfurt) data region** to alert us when something breaks.
- Errors only: no performance tracing and no session replay.
- All personal-data collection is switched off (user info, cookies, headers, bodies, query strings, variable values).
- It's switched on by setting `NEXT_PUBLIC_SENTRY_DSN` in Netlify. Source-map upload is off, so no secret Sentry token is needed.

**Why:** It's the industry standard, free at our size, sends email alerts, and keeps EU data residency. The owner chose it over an in-house error log (no alerts until email arrives in Wave 2) and over relying on Netlify logs.

## 1 October 2026 — Logo taken from the website until official files arrive
**Decision:** With the owner's permission, the white logo from footprintgroup.uk is used in the sidebar and login page, and its infinity mark as the tab icon. See `docs/BRAND.md`.

## 1 October 2026 — Supabase auto-deploys database changes from GitHub
**Decision:** The Supabase GitHub integration's "Deploy to production" is switched on for branch `main`. Migrations in `supabase/migrations/` apply to the Supabase project automatically when merged into `main`. The first migration was applied by hand beforehand and recorded as applied.

**Why:** The owner asked for it. It keeps the database in step with the code without manual SQL.

**Note:** It currently points at the **test** project. When the live London project is created, decide which project follows `main`.

## 1 October 2026 — Sign-in details
**Decision:**
- Staff sign in through a Microsoft Entra app, "Footprint Platform", that only accepts Footprint's own tenant (single tenant). New sign-ins get a profile automatically. The first ever sign-in becomes admin.
- Access is controlled by an `is_active` switch, an `is_admin` switch, and roles made of (feature, action) permissions, where the actions are view, edit and delete.
- The client secret lives only in Supabase and expires after 24 months.

**Why:** Only Footprint staff can get in, using Microsoft's own two-step login. Nothing secret is kept in the code.

## 30 September 2026 — Test database in Frankfurt, live database in London
**Decision:**
- The existing Supabase project in the "Footprint Group - CRM" organisation is the **test** database. It is in **Frankfurt (eu-central-1)** and was auto-created when GitHub was connected. It will be renamed "Footprint Platform – Test".
- The **live** database will be a new project in **London (eu-west-2)** on the Pro plan, created before any real customer data goes in (before Wave 1), with the owner's approval.

This refines the "Supabase, London region" part of the technical foundations decision.

**Why:**
- Test data is fake, and EU storage is within what the owner approved.
- The free plan allows only 2 free projects per person, and the HED project already uses one.
- A project's region can't be changed after it's created. Owner agreed.

## 29 September 2026 — Order of replacement
**Decision:** Replace Zoho first, then monday.com, then Mag Manager, then GoHighLevel (internal use) last.
**Why:** The owner's priority. The main driver is a bespoke, branded in-house platform, not a failing tool.

## 1 October 2026 — GoCardless for customer payments; no card payments
**Decision:**
- Customers pay through **GoCardless** only.
- Recurring invoices are collected by Direct Debit: the customer signs a mandate once, then each invoice is collected automatically.
- One-off invoices can be paid through GoCardless from the invoice link.
- No card payment provider (Stripe) for now.

**Why:** The owner's choice. GoCardless is the UK standard for Direct Debit and works with Xero. It is built in GoCardless's sandbox first, and the real account is set up at go-live.

## 2 October 2026 — Director's improvements: first answers
**Decision:**
- Margin is shown as a **percentage** instead of a £ gross-profit figure, on quotes, orders and invoices (staff only; customers never see cost, GP or margin).
- Commission: show an **example** calculation for now; the real rules come later.
- Monthly goal: **£300,000 per month** for the group, as a placeholder until real numbers are given.
- Staff roles come from **job titles in Microsoft 365 (Entra)**. If titles turn out wrong, switch to Microsoft groups.
- Everyone in Microsoft 365 is **listed in Admin → Users before they first sign in**, with their job title and suggested role, so the admin can sort them out in advance.

**Order:** quick wins (3, 5, 8, 9) → automatic access from Microsoft (1, 2 plus pre-listing) → charts (4) → targets, commission, Staff hub and role home pages (6, 7, 10).

**Why:** The owner's and director's answers, 2 October 2026.

## 5 October 2026 — Real product list copied from Zoho now; product number on every line
**Decision:**
- The **real product list** (names, product numbers, prices, cost prices, suppliers, VAT) is copied from Zoho Books into the platform **now**, ahead of go-live, and copied again at go-live so it's current. This replaces the made-up products. It's an exception to "real data on hold until the final wave": products contain no personal data.
- Quotes and invoices get a **searchable product dropdown** on each line, showing the **product name**.
- Choosing a product puts its **Zoho product number** at the start of the line description, and also stores it on the line (`product_code`), because the product number is what Xero uses to match items.

**Why:** The owner's request and answers, 5 October 2026.

## 6 October 2026 - Product name: FootprintOS

**Decision:** The platform is called **FootprintOS**, a sub-brand of Footprint Group. "Footprint Group" stays as the company name (logo, emails, legal text). Chosen by the owner, replacing the working title "Footprint Platform".
**Manual follow-ups for the owner:** rename the Microsoft Entra app, the Supabase project and the Netlify site; if the Netlify address changes, update the Supabase redirect list first (see PROGRESS.md).

## 7 October 2026 - Email provider: SendGrid instead of Postmark

**Decision:** The platform sends email through **SendGrid**, not Postmark (the owner's choice). Postmark was never approved out of test mode, so nothing live depended on it.
**What changed:** `src/lib/email/sendgrid.ts` replaces `postmark.ts`; same functions, so every email feature works as before. Netlify variables: `SENDGRID_API_KEY` (secret) replaces `POSTMARK_SERVER_TOKEN`; `EMAIL_FROM` and `EMAIL_REPLY_TO` stay; optional `EMAIL_TEST_MODE=true` uses SendGrid's sandbox (accepted, never delivered).
**Owner steps:** create the SendGrid key (Mail Send permission) and add it to Netlify; verify a sender or authenticate the footprintgroup.uk domain in SendGrid (DNS records); remove the old POSTMARK variable afterwards.
