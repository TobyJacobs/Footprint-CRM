# Footprint Platform — Roadmap

_Draft 2 · 29 September 2026 · Reordered: Zoho first, Quote to Invoice as priority · Based on `docs/PROJECT-BRIEF.md`. Technical choices are in `docs/memory/DECISIONS.md`._

We build in **waves**. Each wave delivers something staff can actually use, and — where possible — lets us switch off or reduce an old tool. We finish and test one wave before starting the next.

**Sizes:**
- **S** — about 1–2 weeks
- **M** — about 2–4 weeks
- **L** — about 1–2 months
- **XL** — 2 months or more

These are rough guides for building steadily with Claude. They depend on how much time you have for testing and feedback.

---

## Overview

| Wave | What | Replaces | Size |
|---|---|---|---|
| 0 | Foundations: login, users, teams, roles, security, layout, deployment | — | L |
| 0+ | _Side track (no building):_ password manager and Teams chat | Zoho Vault, Zoho Cliq | S |
| 1 | Customers (the base for quoting) | Zoho CRM (records) | L |
| 2 | **Quote to Invoice** | Zoho Books | L |
| 3 | Projects, Time and Dashboards | Zoho Projects, Zoho CRM analytics → **Zoho One switched off** | M–L |
| 4 | Design Workload | monday.com | S–M |
| 5 | Magazines | Mag Manager → **switched off** | XL |
| 6 | Customer Portal and Online Booking | New | M–L |
| 7 | Reporting and Intranet | Custom HTML sites | M |
| 8 | Marketing (internal use) | GoHighLevel (Footprint's own use only) | L |
| Later | Distributor management | Round Control (possibly) | TBC |
| **Final** | **Go-live cut-over**: create the live London database, rehearse and run the real data imports (Zoho, monday.com, Mag Manager…), test a backup restore, train staff, switch off old tools | All of the above | M–L |

> **Update 1 October 2026:** the live database and all real data are **on hold until the final wave**, after the owner has shown the project to their director. Until then, every wave is built and demonstrated on the test database with **made-up data**, and **no old tool is switched off**. Each wave's "switch off" step now happens in the **Final** cut-over. See `DECISIONS.md`.

---

## Why this order

1. **Foundations first (Wave 0).** Login, permissions, the audit log and backups must be solid before any real customer data goes in. Getting security right later is much harder than building it in from day one.

2. **Zoho first, with Quote to Invoice as the priority (Waves 1 → 2 → 3).** The owner's choice (confirmed 29 September 2026).
   - Every quote and invoice belongs to a customer, so a lean Customers wave comes first.
   - Projects link to customers and orders, so it comes after Quote to Invoice.
   - **Zoho One is a bundle**: it can only be cancelled once Books, CRM, Projects, Vault and Cliq are *all* replaced. That happens at the end of Wave 3 — the biggest single saving.

3. **Design Workload after Zoho (Wave 4).** It's small, and by then work items can link straight to customers, orders and projects.

4. **Mag Manager next (Wave 5).** It's specialised and business-critical, so it goes after we've proven the billing and Xero connection in Wave 2. Switch-over happens **between issues**, never mid-issue.

5. **Customer Portal after the things it shows (Wave 6).** The portal displays quotes, invoices and bookings, so those must exist first. Online booking builds on Magazines.

6. **Reporting, intranet and marketing last (Waves 7–8).** These are lower risk, and GoHighLevel stays in use for Your Lead Kit anyway.

### Where the password vault goes
**It's not built at all.** In the side track alongside Wave 0, Footprint moves to a proven password manager (1Password or Bitwarden). Passwords are the most sensitive data in the business. Proven products are independently security-audited, cost about £3–£7 per person a month, and are safer than anything we could build. This must be done before Zoho One is switched off (end of Wave 3).

---

## Wave 0 — Foundations
**Goal:** a secure, empty shell of the platform that staff can log in to, ready for features to be added.

**Included:**
- Next.js app on Netlify, deploying automatically from GitHub, with a **preview link** for every change.
- Two Supabase databases in London:
  - **test** — for previews, with fake data
  - **live** — for real data
- **Staff login with Microsoft 365**, using Microsoft's two-step login.
- **Users, teams, roles and permissions framework**, with admin screens to add people, create teams, define roles and tick which features and actions each role can use. Nothing is hard-coded.
- **Permissions enforced inside the database**, so users can only ever read the data their role allows.
- **Audit log** recording who created, changed, deleted (and, for sensitive records, viewed) what and when, with an admin screen to search it.
- **App layout:**
  - Footprint branding
  - a navigation menu with **one section per feature**, showing only the sections the user may see
  - works on phones and tablets
- **Backups:** daily plus point-in-time restore. **A test restore is done and written up.**
- File storage ready for attachments (e.g. design drafts).
- Basic error monitoring, so we know if something breaks.

**Done when:**
- You can sign in with your Microsoft account.
- As an admin, you can create a team and a role, give it access to a test section, and add a user.
- That user sees only what the role allows.
- The action appears in the audit log.
- A backup has been restored successfully.

**Replaces:** nothing yet. **Size:** L. **Depends on:** Netlify, Supabase and Microsoft 365 admin access (see "Before we start").

---

## Wave 0+ — Side track: password manager and team chat (no building)
**Goal:** move passwords and chat off Zoho early, so they don't hold up the Zoho switch-off.

**Included:**
- Choose 1Password or Bitwarden, set up shared vaults by team, and move passwords over from Zoho Vault.
- Staff start using Microsoft Teams chat instead of Zoho Cliq.

**Done when:** all passwords are in the new manager and Cliq is no longer used.

**Replaces:** Zoho Vault, Zoho Cliq (their use; the Zoho One bill continues until Wave 3). **Size:** S. **Depends on:** nothing — can start any time.

---

## Wave 1 — Customers
**Goal:** one place for every customer, contact and relationship — the base that quotes and invoices are built on.

**Included:**
- Customer (company) records with **multiple contacts**.
- **Web hosting plans** (with web and email hosting details) and **digital retainers** (with monthly services) recorded against each customer. Zoho Billing subscriptions move in Wave 2, together with billing. _(Updated 1 October 2026; see `docs/discovery/ZOHO-CRM.md`.)_
- **Activity timeline** per customer (notes now; emails, quotes, invoices and bookings are added in later waves).
- Search, filters and GDPR tools: export a person's data, delete or anonymise on request, and record marketing consent.
- **Migration:** all **~15,000 customers and their contacts** from Zoho CRM/Books.
  - Built and tested with **made-up** customers on the test database. Real data only goes into the **live London database**, rehearsed first on a temporary copy that is deleted afterwards.
  - Third-party passwords are **not** migrated (see DECISIONS).
  - Record counts checked, and staff spot-check a sample.
- **Until Wave 2 goes live**, Zoho Books still needs customers. We run a **one-way nightly copy from Zoho → platform**, so staff can look customers up in the platform while still quoting in Zoho.

**Done when:** all customers and contacts are in the platform, counts match, staff have checked a sample, and staff use the platform to look up customer details.

**Replaces:** Zoho CRM customer records (Zoho stays until Wave 3). **Size:** L. **Depends on:** Wave 0.

_Kept lean on purpose: only what quoting and invoicing need, so we reach Quote to Invoice as quickly as possible._

---

## Wave 2 — Quote to Invoice
**Goal:** the whole quote-to-invoice process runs in the platform.

**Included:**
- **Quotes** with line items, VAT and branded PDFs, **sent digitally**. The customer **approves online** through a secure link, and the approval is recorded.
- Approved quotes become **sales orders**, then **invoices**. **Purchase orders** go to suppliers.
- **Subscription billing:** recurring invoices for subscriptions and hosting plans.
- **Email sending through Postmark**, logged on the customer timeline.
- **Payments:** Stripe (card), GoCardless (Direct Debit) and bank transfer recorded.
- **Xero connection:** invoices (and payments) sent to Xero automatically.
- **Migration:** full history of quotes, orders, POs and invoices from Zoho Books.
- **Parallel run:** for one billing cycle, invoices are checked against Zoho before we fully switch.
- The Zoho → platform nightly customer copy is switched off. The platform becomes the master customer list.

**Done when:**
- A full month's quoting, ordering and invoicing has run in the platform.
- Xero matches.
- Subscriptions billed correctly.
- The finance team signs it off.

**Replaces:** **Zoho Books** (use stops; Zoho One bill continues until Wave 3). **Size:** L. **Depends on:** Wave 1; Xero, Stripe, GoCardless and Postmark accounts.

---

## Wave 3 — Projects, Time and Dashboards
**Goal:** finish replacing Zoho so it can be switched off.

**Included:**
- **Projects** linked to customers and orders, with **tasks**, **assigned users** and deadlines.
- **Time tracking** against tasks, plus timesheets.
- **Dashboards and analytics** replacing Zoho CRM's: sales, pipeline, revenue, renewals, and time by project or person. Role-based, so people only see figures they're allowed to.
- **Migration:** projects, tasks and time logs from Zoho Projects.
- **Zoho switch-off checklist:**
  - all data exported and archived
  - Vault and Cliq already moved (Wave 0+)
  - nothing still depending on Zoho

**Done when:** staff have used projects and time tracking for a month, the dashboards are signed off, and **Zoho One is cancelled**.

**Replaces:** **Zoho Projects and Zoho CRM → whole of Zoho One switched off.** **Size:** M–L. **Depends on:** Waves 1 and 2, and Wave 0+ complete.

---

## Wave 4 — Design Workload
**Goal:** the design team manages its workload in the platform instead of monday.com.

**Included:**
- A list of design work items, each with:
  - **status**
  - **high-priority marker**
  - who it's assigned to and the due date
  - **attached drafts**
  - **notes**
- Work items linked to customers, orders and projects.
- Filters and views (e.g. by designer, status or priority).
- Ideas taken from the earlier replacement tool, if its code can be found.
- **Migration:** move open work items from monday.com.

**Done when:** the design team has worked only in the platform for 2 weeks, and monday.com can be cancelled.

**Replaces:** **monday.com** (switched off). **Size:** S–M. **Depends on:** Waves 1–3.

---

## Wave 5 — Magazines
**Goal:** run Forget Me Not entirely in the platform.

**Included** (to be confirmed with the magazine team against a full list of Mag Manager features before building):
- **Editions** (the 11 areas) and **issues** (monthly).
- **Ad sales and bookings:** sizes, positions, rates, series bookings.
- **Flatplans:** a visual page-by-page plan per edition and issue.
- **Artwork tracking:** received, in design (linked to Design Workload), approved.
- **Advertiser billing:** invoices through the Wave 2 billing engine, sent to Xero.
- Reports: revenue per edition and issue, space sold, bookings pipeline.
- **Migration:** advertisers (merged with existing customers), bookings and billing history from Mag Manager.
- **Switch-over between issues**, with the next issue run in both systems if needed.

**Done when:** a full issue cycle (booking → flatplan → artwork → billing → Xero) has run in the platform, and **Mag Manager is cancelled**.

**Replaces:** **Mag Manager** (switched off). **Size:** XL — likely split into 5a (editions, bookings, flatplans) and 5b (billing and switch-over). **Depends on:** Waves 1, 2 and (for artwork) 4.

---

## Wave 6 — Customer Portal and Online Booking
**Goal:** customers can serve themselves.

**Included:**
- **Customer portal** with a separate login (email plus two-step code). Customers see their quotes, approve them, see invoices, **pay online** and update contact details.
- **Online booking for Forget Me Not advertisers:** choose editions and sizes, see the price (linked to the website's cost calculator and "request a space" form), book and pay. Bookings land straight on the flatplan.
- GDPR: customers can see and download their data.

**Done when:** real customers use the portal to view and pay invoices, and advertisers book space online end to end.

**Replaces:** new capability (the Mag Manager wish list). **Size:** M–L. **Depends on:** Waves 2 and 5.

---

## Wave 7 — Reporting and Intranet
**Goal:** bring the existing custom HTML reporting sites and intranet into the platform.

**Included:** rebuild the reporting dashboards on live platform data, plus intranet pages (news, documents, policies, staff directory), all behind the same login and permissions.

**Done when:** the old HTML sites are retired.

**Replaces:** **custom HTML sites.** **Size:** M. **Depends on:** Wave 3 (dashboards) and Wave 0.

---

## Wave 8 — Marketing (Footprint's internal use)
**Goal:** run Footprint's own marketing from the platform.

**Included (to be scoped in detail nearer the time):** email and SMS campaigns to customers who have consented, sales pipelines, and simple forms or landing pages if needed.

**Done when:** Footprint's own campaigns run from the platform.

**Replaces:** **GoHighLevel for internal use only.** Your Lead Kit stays on GoHighLevel. **Size:** L. **Depends on:** Waves 1 and 2.

---

## Later — Distributor management
Absorb Forget Me Not distributor management (details, routes, pay, GPS tracking) if Round Control doesn't meet every need. To be reviewed after Wave 5.

---

## Before we start Wave 0 — what's needed from you
1. **GitHub push access** from this computer, so every session is backed up.
2. **Netlify:** confirm the site is connected to this repository and that you can add environment settings (where secrets are kept).
3. **Supabase:** an account or organisation for Footprint (Pro plan needed for the live database).
4. **Microsoft 365 admin:** someone who can register the platform as an app so staff can sign in with Microsoft. I'll give step-by-step instructions.
5. **Branding:** logo files, brand colours and fonts.
