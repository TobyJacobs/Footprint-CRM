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
