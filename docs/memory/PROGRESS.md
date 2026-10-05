# Progress — where we are right now

_Last updated: 1 October 2026_

## Current stage
**Wave 1 — Customers: built and LIVE for the demo** (PR [TobyJacobs/Footprint-CRM#3](https://github.com/TobyJacobs/Footprint-CRM/pull/3) merged as `e5276cf`, 1 October 2026). It's on footprinthub.netlify.app, using the **test database with made-up data only**. The owner will show it to their director.

Still to do for Wave 1: the Zoho import tool (built against made-up Zoho-format files). The real import and nightly sync wait for the final cut-over.

## Done
- Planning (Session 1):
  - brief (`docs/PROJECT-BRIEF.md`)
  - roadmap (`docs/ROADMAP.md`, owner-confirmed order)
  - decisions (`DECISIONS.md`)
  - brand guide (`docs/BRAND.md`)
- Planning work merged into `main` (30 September 2026).
- Setup: GitHub auto-push ✅, Supabase organisation ✅, Netlify connected ✅, Microsoft 365 admin ✅, Node.js 24 installed ✅.
- **Wave 0 part 1: app shell**
  - Next.js 16 app with Footprint branding.
  - One navigation section per feature (`src/lib/features.ts`), each a placeholder.
  - Works on mobile.
- **Wave 0 part 2: code (branch `wave-0/foundations`)**
  - Database migration `supabase/migrations/20260930120000_foundations.sql`:
    - profiles, teams, team_members, roles, role_permissions, user_roles, audit_log
    - row-level security everywhere
    - helper functions `is_admin()`, `has_permission()` and `my_permissions()`
    - audit triggers
    - the first person to sign in becomes admin
  - Sign in with Microsoft through Supabase: `src/app/login`, `src/app/auth/callback` and `src/app/auth/signout`.
  - `src/proxy.ts` refreshes the session and sends signed-out visitors to /login. `src/lib/auth.ts` (`getCurrentUser`) is the single place that works out who's signed in and what they can do.
  - The menu only shows sections the user can view. Admin screens cover users, teams, roles & permissions, and the audit log.
- **Wave 0 part 2: setup (1 October 2026)**
  - Supabase test project renamed **"Footprint Platform – Test"** (ref `ifspqkcdatruybgzygic`, Frankfurt).
  - Migration applied by hand in the SQL editor, and recorded in `supabase_migrations.schema_migrations` so the GitHub integration won't re-run it.
  - Supabase GitHub integration: **"Deploy to production" is ON for branch `main`** (the owner asked for it). New migrations merged to `main` apply to the test project automatically.
  - Supabase Auth redirect URLs:
    - `http://localhost:3000/**`
    - `https://footprinthub.netlify.app/**`
    - `https://*--footprinthub.netlify.app/**`
  - Microsoft Entra app **"Footprint Platform"** registered in the Footprint Copy & Design tenant:
    - single tenant only
    - redirect to the Supabase callback
    - optional ID-token claims `email` and `xms_edov`, plus the Graph `email` permission
  - The Supabase Azure provider is enabled. The owner pasted in the client secret (**24-month expiry, created 1 October 2026 → renew before September 2028**).
  - `.env.local` on the owner's computer points at the test project (git-ignored).
  - Checked: clicking "Sign in with Microsoft" locally reaches Footprint's Microsoft sign-in page.

- **1 October 2026, tested:**
  - The owner signed in locally and became the first admin. They created a team, and the audit log recorded it.
  - Netlify environment variables added: Claude added the URL; the owner pasted the publishable key.
  - Pull request [TobyJacobs/Footprint-CRM#1](https://github.com/TobyJacobs/Footprint-CRM/pull/1) is open. The first preview returned 404 because Netlify hadn't enabled its Next.js runtime (the site was created from an empty repo). Fixed by adding `@netlify/plugin-nextjs` to `netlify.toml` and devDependencies.
  - The preview at https://deploy-preview-1--footprinthub.netlify.app now shows the sign-in page. Netlify previews are also protected by a Netlify login.

- **1 October 2026: merged and live.**
  - The owner tested sign-in on the preview. Claude merged PR #1 into `main` (merge commit `1f3fa05`) at the owner's request.
  - Netlify published it to **https://footprinthub.netlify.app**.
  - Checked afterwards: the Supabase data is intact (1 profile, 1 team, only migration `20260930120000` recorded).

- **Wave 0 finishing**: PR [TobyJacobs/Footprint-CRM#2](https://github.com/TobyJacobs/Footprint-CRM/pull/2), merged as `a921069`, 1 October 2026:
  - Logo from footprintgroup.uk in the sidebar and login page. Infinity tab icon (`src/app/icon.png`).
  - Security headers in `next.config.ts`.
  - **Sentry** error alerts:
    - org `footprint-group`, EU region, project `footprint-platform`
    - errors only, personal-data collection off
    - DSN set in Netlify as `NEXT_PUBLIC_SENTRY_DSN`
    - the owner tested it with Admin → System → "Send a test error" and it worked
  - Friendly global error page.
  - Backup runbook `docs/runbooks/BACKUPS.md`.

- **Wave 1 in progress** (branch `wave-1/customers`, 1 October 2026):
  - Zoho discovery (`docs/discovery/ZOHO-CRM.md`): field definitions read from Zoho CRM settings (EU, org `20091739281`), never records. The scope decisions are in `DECISIONS.md`.
  - Migrations `20261001120000_customers.sql` and `20261001130000_profile_names.sql`. Both are applied by hand to the **test** database and recorded in `supabase_migrations`.
  - Customers section built:
    - list with search (also by contact name, email, phone, postcode), status and service filters, 50 per page
    - customer page with details, contacts, hosting plans (web and email lines), digital retainers (monthly services), and a timeline of notes, calls, emails and meetings
    - add, edit and delete forms; deletes ask "Are you sure?"
    - everything is checked against the "customers" permission
  - 60 **made-up** customers in the test database (`supabase/seed/fake-customers.sql`, test only).
  - Tested in the browser: list, search, customer page, edit, add contact (primary contact swap, opt-out), hosting lines, retainer services, timeline note.
  - Bug found and fixed: saving web and email hosting lines together failed and lost the old lines. Child lines are now saved before the old ones are removed.

  - **GDPR tools** (migration `20261001140000_gdpr.sql`, applied to test):
    - admin-only **export** (JSON download) for a contact or a whole customer
    - admin-only **erase** for a contact or a whole customer: details blanked, the record kept as "Removed (GDPR)", and the audit log cleaned (redacted) with an erasure event recorded
    - `erased_at` flags erased records so the import and sync never bring them back
    - staff runbook in `docs/runbooks/GDPR-REQUESTS.md`
    - tested on made-up data: export contents, contact erase (audit log no longer mentions the person), customer erase

- **Wave 2a LIVE for the demo**: PR [TobyJacobs/Footprint-CRM#4](https://github.com/TobyJacobs/Footprint-CRM/pull/4) merged as `3b85ccb` on 1 October 2026, using the test database with made-up data. Netlify visibility is now "previews only" (live public), so the approval link `/q/…` opens on live for signed-out customers (checked).
- **Wave 2c in progress** (branch `wave-2c/recurring-billing`, 1 October 2026):
  - **Step 1 done: recurring invoices.** Migration `20261003120000_recurring_invoices.sql`, applied to test:
    - templates plus lines
    - `sales_documents.recurring_invoice_id`
    - internal numbering helper
    - `_generate_recurring_invoice`, `generate_due_recurring_invoices` (catches up missed periods, max 24)
    - staff `generate_recurring_invoice_now`, admin `run_recurring_billing_now`
    - **pg_cron job "generate-recurring-invoices" daily at 06:00 UTC**
  - UI:
    - Recurring tab (with the monthly value of active billing)
    - new / edit (reuses the document editor)
    - view: create now, pause, resume, end, and the invoices created
    - "Set up recurring billing" on hosting plans and retainers (pre-fills customer, price and frequency)
  - Tested: from Downs Garage's hosting plan, next date 1 September → "Run billing now" created INV-074892 (Sept) and INV-074893 (Oct) as drafts (£42, due +30 days), and the next date moved to 1 November.
  - **Step 2 done: emailing via Postmark (test mode).** Migration `20261003130000_email.sql`, applied to test:
    - `email_log` (every email sent, audited, RLS on "quotes")
    - `get_public_document` (read-only private link for non-draft invoices, credit notes and orders)
  - UI:
    - "Email to customer" card on documents: To, CC, subject and message are pre-filled, plus email history
    - sending a draft quote marks it sent; a draft invoice or credit note becomes issued
    - "Customer view link" `/d/…` opens without login
    - every email is also logged on the customer timeline
  - Tested on 1 October 2026: emailed INV-074893 in Postmark test mode. It became Issued, the log showed "Test", the `/d/` link opened signed out, and a made-up link showed "Document not found".
  - To send real email later, the owner needs to:
    - sign up to Postmark and add its DNS records for footprintgroup.uk
    - put `POSTMARK_SERVER_TOKEN` (secret) and `EMAIL_FROM` in Netlify
  - Next: steps 3 and 4 (GoCardless only, see DECISIONS), then step 5 (Xero sync).
  - **ON HOLD from 2 October 2026** while we work through the director's list of improvements. To resume, the owner signs up for a GoCardless sandbox account and pastes the access token themselves.
- **Wave 2b LIVE for the demo**: PR [TobyJacobs/Footprint-CRM#5](https://github.com/TobyJacobs/Footprint-CRM/pull/5) merged as `1ae79cf` on 1 October 2026 (test data only).
- **Wave 2b details** (branch `wave-2b/purchase-orders-credit-notes`):
  - Migration `20261002130000_purchase_orders_credit_notes.sql`, applied to test:
    - `credit_note` doc type plus `credit_reason`
    - suppliers gain a contact name and account reference
    - `purchase_orders` and lines (PO- numbering, totals by database, audit, RLS on "quotes")
  - **Purchase orders:**
    - list, editor (at our cost), view, print
    - draft → sent → received → closed, or cancelled; only drafts can be deleted
    - "Raise purchase orders" on a sales order creates one PO per product supplier
  - **Suppliers** tab: contact details, product and open-PO counts, recent POs.
  - **Credit notes:** raised from an issued or paid invoice (copies lines; edit for a partial credit), with a reason. The invoice shows "Credited" and "Balance". Issued credit notes and invoices are locked from editing and deletion.
  - Fixed: adding purchase_orders made the "customers" link from sales_documents ambiguous, so the explicit hint `customers!sales_documents_customer_id_fkey` is now used.
  - Tested: SO-010913 → PO-03271 (Digiprint £54) and PO-03272 (Design £72); PO-03271 sent → received → closed and printed; INV-074891 → CN-00009, edited to £66 (Pricing error) and issued, so the invoice balance is £274.80.
  - Note: the local dev server sometimes keeps serving old code after edits. Restart the preview if a change doesn't show.
- **Wave 2a details** (built on branch `wave-2/quote-to-invoice`):
  - Zoho Books discovery: `docs/discovery/ZOHO-BOOKS.md` (settings only; org `20091743642`, custom domain business.footprintsouth.co.uk).
  - Migration `20261002120000_sales.sql`, applied to test:
    - VAT rates, suppliers, products
    - number sequences continuing Zoho (QT-009972, SO-010913, INV-074891, PO-03271, CN-00009)
    - company settings
    - sales_documents and lines, with database-calculated totals and gross profit
    - quote approval functions (`get_quote_by_token`, `respond_to_quote`)
  - 12 **made-up** products (`supabase/seed/fake-products.sql`).
  - Screens:
    - Quotes & Invoices tabs: quotes, orders, invoices, products
    - a shared document editor with customer and product search, live totals and GP
    - the document page, with next-step buttons and linked documents
    - convert quote → order → invoice
    - issue, mark paid or void
    - print / save as PDF (dark logo)
    - Admin → Company (details, bank details, default wording, numbering)
    - a quotes section on the customer page
    - the public approval page `/q/[token]`
  - Tested end to end on localhost: QT-009972 created (£340.80, GP £179), marked sent, accepted anonymously with a PO and note, converted to SO-010913 (PO carried over), then INV-074891 (due in 30 days) → Issued → Paid. Issued invoices can't be deleted. The print layout was checked.

## Next
1. **Finish Wave 1:**
   - the **Zoho import tool**: map the Zoho export to our tables; never import third-party passwords; skip legacy fields
   - the one-way nightly Zoho → platform copy (needs a Zoho API connection; its secret is set by the owner)
2. **ON HOLD (owner, 1 October 2026):** the live London database, the real Zoho import, the nightly sync and switching off old tools. These wait until the owner has shown the project to their director, and until the final wave. Keep building on the test database with made-up data only.
3. Open a pull request for `wave-1/customers` so the owner can check it on the preview.
2. Before any real customer data goes in:
   - create the **live London Supabase project** (Pro plan, owner approval)
   - point Netlify production at it
   - run the first **backup restore test** (see the runbook)

## Waiting on the owner
- Official logo files, ideally SVG (optional; the website logo is in use).

## Key IDs (not secret)
- Netlify site: `footprinthub` → https://footprinthub.netlify.app
- Supabase test project ref: `ifspqkcdatruybgzygic`
- Entra app (client) ID: `40bb9fdf-798e-4644-a888-b0e2e788f495`
- Tenant ID: `b2165b1f-511b-4829-a947-40cc1fbbb769`

## How backups work on this computer
Git Credential Manager holds the owner's GitHub sign-in, so **Claude pushes automatically after every commit**.

## Local running
The dev server runs from the Claude desktop preview (`.claude/launch.json` in `Documents\claude`) at http://localhost:3000.

## Director's improvements list (received 2 October 2026, not yet started)
1. New staff with a Footprint email get access automatically.
2. Staff roles assigned automatically from their job role in Microsoft Entra.
3. "Resend" buttons on quotes and invoices.
4. Live charts in the Quotes & Invoices section.
5. Customer approves a quote online, and it then moves to sales orders automatically.
6. Split "Reports & Intranet" into a Staff hub (personal monthly progress, by role) and Reports.
7. Commission calculated per staff member per month.
8. Raise a purchase order or order from a supplier inside a sales order.
9. Margin shown as a percentage; customers only ever see their price, never cost or GP.
10. Home page that changes by role: directors see group GP and monthly goals, the sales team sees their own stats, and so on.

## Director's improvements: batch 1, quick wins (branch `improvements/quick-wins`, 2 October 2026), done and tested
- **Item 9:** the profit box is now "Margin", showing a big % (staff only). The £ gross profit line was removed from the document page and the editor. Customer pages show prices only (checked on `/q/`).
- **Item 3:** after the first email, a one-click "Resend quote/invoice/…" button goes to the same address with a "Reminder:" subject. The full form is tucked under "Send to someone else or change the message". Tested on INV-074893.
- **Item 5:** migration `20261004120000_auto_order_on_accept.sql` (applied to test) adds `_convert_quote_to_order`. Accepting online now creates the sales order at once (customer PO goes into the reference) and marks the quote converted. Tested: made-up quote QT-009973 accepted on `/q/` → SO-010914.
- **Item 8:** the sales order button is now "Order from suppliers (raise POs)". The PO page has a "Place order with supplier" email box: the email includes a lines table, needed-by date and delivery address, and moves a draft PO to "sent". Migration `20261004130000_po_email.sql` (applied) adds `email_log.purchase_order_id`. Tested on PO-03273 (to a made-up address).
- Next: items 1 and 2 plus pre-listing staff from Microsoft 365 (needs an Entra permission the owner approves).

## Director's improvements: batch 2, staff from Microsoft 365 (items 1 and 2), built and waiting on admin consent (2 October 2026)
- Migration `20261005120000_staff_directory.sql` (applied to test) adds:
  - tables `staff_directory`, `job_role_rules`, `directory_sync_runs`, `directory_sync_settings`
  - `user_roles.source` ('manual' / 'directory')
  - functions `suggested_role`, `_apply_directory_access`, `reapply_directory_roles`, `directory_sync_apply` (admin, or the daily job with a key whose sha256 is stored), `set_directory_sync_key_hash`
  - `handle_new_user` now links the directory entry and gives the role at first sign-in
  - `protect_profile_flags` lets the sync switch leavers off
- App:
  - `src/lib/entra/` (Graph client-credentials, rules)
  - new tab Admin → Microsoft 365 (`/admin/directory`): Sync now, run history, job title rules, list of job titles, daily sync key
  - `/admin/directory/[dirId]` for people who haven't signed in yet
  - Users list shows everyone with job title and sort options
  - the user page has a "From Microsoft 365" role picker; directory roles are locked in the "Extra roles" list
  - `/api/cron/directory-sync` plus Netlify scheduled function `netlify/functions/directory-sync.mts` (05:00 UTC daily)
- Entra:
  - app "Footprint Platform" now has the **User.Read.All (Application)** permission
  - client secret "Staff sync" created by the owner, held in `.env.local` only
  - **Admin consent FAILED**: Toby's account isn't Global Admin. The tenant is "Footprint Copy & Design", and a Global Administrator must click "Grant admin consent".
- Tested: with the secret, "Sync now" reaches Microsoft and gets "needs admin consent" (so the secret works).
- The test database has **no roles yet**. They need creating (e.g. Director, Sales, Studio, Accounts) before job title rules can be added.
- Still to do at go-live: add `ENTRA_TENANT_ID`, `ENTRA_CLIENT_ID`, `ENTRA_CLIENT_SECRET` (secret), `STAFF_EMAIL_DOMAINS` and `DIRECTORY_SYNC_KEY` (secret, from Admin → Microsoft 365) to Netlify.

## Director's improvements: item 4, charts (2 October 2026), done and tested
- Migration `20261006120000_sales_stats.sql` (applied to test): `sales_stats(p_from, p_owner)`, a security-invoker function so RLS applies. It adds everything up in the database, so it isn't affected by the 1,000-row API limit.
- `src/lib/sales/stats.ts`, Recharts components in `src/components/charts/` (SalesCharts, ChartFilters), brand colours.
- New **Overview** tab (first tab; `/sales` now opens it):
  - tiles: invoiced, margin %, win rate, open quotes, owed / overdue
  - charts: invoiced per month (paid / unpaid plus margin line), quotes won / lost / quoted, money owed by lateness, top customers
  - filters: period (3/6/12/24 months), salesperson
- A 6-month chart strip sits above the Quotes and Invoices lists.
- Made-up history `supabase/seed/fake-sales-history.sql` was run on TEST: about 200 quotes over 12 months, marked internal_notes = 'DEMO DATA'.
- The Microsoft 365 admin consent is paused at the owner's request (2 October 2026). Only the @footprintgroup.uk domain is used, as confirmed.

## Director's improvements: items 6, 7 and 10, role home pages, Staff hub, targets and commission (2 October 2026), done and tested
- Roles from the owner: **Directors, Sales team, Finance team, Operations team**. More will be added later, which is why each role has a **dashboard type** (`roles.dashboard`: director / sales / finance / operations / general), picked in Admin → Roles. New roles need no code.
- Migration `20261007120000_dashboards_targets_commission.sql` (applied to test) adds:
  - `roles.dashboard`, `my_dashboards()`
  - `sales_documents.paid_at` plus a `set_paid_at` trigger
  - `monthly_targets` (group or person; every month or one month; invoiced / gross_profit / margin_pct)
  - `commission_rules` (standard plus personal; % of GP or sales; when paid or raised)
  - `team_month_stats(from, to)` (security invoker)
  - the 4 roles with permissions, and starting job-title rules (Director, Sales, Account Manager, Business Development, Finance, Accounts, Bookkeep, Operations, Production, Print)
  - seeds: group goal £300,000/month (example), target margin 45% (example), commission 10% of GP on paid invoices (example)
  - RLS on targets and commission: read your own, group or default ones; directors, finance and admins read all; admins write
- New `hub` feature ("Staff hub", `/hub`). "Reports & Intranet" is renamed "Reports".
- Home page `/` shows dashboards by role, with tabs if someone has several. Admins with no role get the Directors view. Feature tiles move under "Your sections".
  - Directors: goal bar with pace marker, GP, margin against target, pipeline, owed, cash in, recurring, quotes, credit notes, team table (target %, GP, margin, won, commission), 12-month chart, owed chart.
  - Sales: own goal bar, commission, GP, win rate, leaderboard rank, open quotes (expiring ones flagged), latest invoices.
  - Finance: invoiced against budget, margin against target (in points), cash in, GP, owed, credit notes, recurring, draft invoices, owed chart, oldest overdue.
  - Operations: open orders, past deadline, POs to send, late deliveries, supplier spend, orders due soonest, orders by production step, unsent POs, late POs.
- Staff hub: month picker (6 months), own and group goal bars, commission / GP / quotes tiles, commission history (with "based on" column), own documents.
- Admin → **Targets & commission** (`/admin/targets`): group goals, one-month overrides, personal targets (people with Sales or Directors roles), standard and personal commission rules.
- Test data:
  - Toby's test account was given all 4 roles so the demo can switch views
  - Toby has a test personal target of £25,000
  - made-up open orders and POs were added (DEMO DATA)
- Every made-up document is owned by Toby, so the team table has one row until other staff exist.

## Sales team see only their own documents (2 October 2026), done and tested
- Owner decision: salespeople only see their own quotes, orders and invoices. Customers stay visible to all.
- Migration `20261008120000_own_records_only.sql` (applied to test) adds:
  - `roles.own_records_only` (ON for Sales team)
  - `sees_all_sales()`, `can_see_sales_owner`, `can_see_sales_document`, `can_see_purchase_order`, `can_see_recurring_invoice`
  - rebuilt RLS on sales_documents and lines, purchase_orders and lines, recurring_invoices and lines, and email_log
  - `my_sales_rank()` (leaderboard place without others' figures)
- The rule: you see all documents if you're an admin, or if any of your roles has Quotes view without "own only". Otherwise you see only documents where you are the salesperson, and you can't create or hand documents to anyone else.
- App:
  - `CurrentUser.seesAllSales`
  - `getSalespersonOptions()` (only yourself if restricted)
  - save actions force owner = self when restricted
  - a role tick-box "Only their own quotes, orders and invoices"
- Tested with a rolled-back dry run (a test account set non-admin with Sales team only): saw 1 of 356 documents and 0 POs; inserting for someone else was blocked; inserting for self was allowed; reassigning was blocked.

## LIVE for the demo, 2 October 2026
- PR [TobyJacobs/Footprint-CRM#6](https://github.com/TobyJacobs/Footprint-CRM/pull/6) merged as `fb862d0`. It contains Wave 2c (recurring billing, email) plus all the director's improvements (1–10, apart from the Microsoft 365 consent) and sales-only-own-documents.
- Checked on https://footprinthub.netlify.app: the Directors home page loads with figures (test database, made-up data).
- Not set on Netlify yet (so these show as "not switched on" on live):
  - `POSTMARK_SERVER_TOKEN`, `EMAIL_FROM`
  - `ENTRA_TENANT_ID`, `ENTRA_CLIENT_ID`, `ENTRA_CLIENT_SECRET`, `STAFF_EMAIL_DOMAINS`, `DIRECTORY_SYNC_KEY`
- Still waiting:
  - Global Administrator consent for User.Read.All
  - GoCardless sandbox account (Wave 2c steps 3 and 4)
  - Xero (step 5)

## Mobile fit (2 October 2026)
- Problem: on phones some pages were wider than the screen (Directors team table, document lines, Staff hub table, Microsoft 365 tables, long codes), so the black top bar looked too short.
- Fixes in `globals.css`:
  - `.grid > * { min-width: 0 }`, so wide tables scroll inside their box
  - `overflow-wrap` for long words and codes
  - a `no-scrollbar` utility on tab strips
- Wrapped 4 tables in `overflow-x-auto`: hub commission, directory rules and titles, recurring detail.
- Measured at 320, 375, 414 and 768 px across about 30 pages (via a same-origin iframe, with a temporary dev-only X-Frame-Options change that was reverted). Every page's width now equals the screen width. The black bar spans the full width with the logo and menu inside.

## Wave 3: projects and time. ON HOLD from 5 October 2026 (owner asked to switch to the Customers page)
- Branch `wave-3/projects`.
- Done:
  - discovery `docs/discovery/ZOHO-PROJECTS.md`
  - decisions (projects automatic from sales orders, timer plus manual time, example £25/hr cost rates)
- Migration `20261009120000_projects_time.sql` is **applied to test**. It adds:
  - projects (FO- numbering from 1498), project_tasks, project_templates and their tasks (4 starter templates)
  - time_logs (one running timer per person), staff_cost_rates, `company_settings.default_hourly_cost`
  - `project_time_costs()`
  - a trigger so every new sales order creates a project
  - a fix so `_take_document_number` no longer cuts off long numbers
  - projects back-filled for the existing test sales orders
- **Not built yet:** all the app pages (projects list and detail, tasks, timer, timesheet, templates, cost rates).
- The live demo uses the test database, so new sales orders there now quietly get a project. That's harmless.
