# Progress — where we are right now

_Last updated: 19 October 2026 (Part 4b)_

## Current stage
**Waves 0, 1, 2 (2a/2b/2c) and the Wave 3 building work are LIVE** on https://footprintgroupos.netlify.app, along with the Marketing workspace, Dashboards, profit after time and the 15 October 2026 health-check fixes. The live site still uses the **test database** (Frankfurt); the move to the London database, every Zoho import and the switch-offs all sit in the final Go-live stage.

No pull requests open (16 October 2026): the owner merged #32 (Staff hub one-pass) and #33 (health-check fixes). For what's next, see **"Next (as of 15 October 2026)"** at the bottom of this file. The sections in between are a dated history, oldest first.

_Earlier snapshot (1 October 2026): Wave 1 — Customers went live for the demo (PR [TobyJacobs/Footprint-CRM#3](https://github.com/TobyJacobs/Footprint-CRM/pull/3), `e5276cf`)._

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

## Next (as of 1 October 2026; superseded, kept for history — see "Next (as of 15 October 2026)" at the bottom)
1. **Finish Wave 1:**
   - the **Zoho import tool**: map the Zoho export to our tables; never import third-party passwords; skip legacy fields
   - the one-way nightly Zoho → platform copy (needs a Zoho API connection; its secret is set by the owner)
2. **ON HOLD (owner, 1 October 2026):** the live London database, the real Zoho import, the nightly sync and switching off old tools. These wait until the owner has shown the project to their director, and until the final wave. Keep building on the test database with made-up data only.
3. Open a pull request for `wave-1/customers` so the owner can check it on the preview.
4. Before any real customer data goes in:
   - create the **live London Supabase project** (Pro plan, owner approval)
   - point Netlify production at it
   - run the first **backup restore test** (see the runbook)

## Waiting on the owner
- Official logo files, ideally SVG (optional; the website logo is in use).

## Key IDs (not secret)
- Netlify site: `footprintgroupos` → https://footprintgroupos.netlify.app (renamed from `footprinthub` on 6 October 2026; the old address no longer works)
- Supabase test project ref: `ifspqkcdatruybgzygic` (Frankfurt; the live site uses this one for now)
- Supabase live project ref: `khjcplhuenureeobvzqo` (London, "FootprintOS - Live"; nothing uses it yet)
- Entra app (client) ID: `40bb9fdf-798e-4644-a888-b0e2e788f495`
- Tenant ID: `b2165b1f-511b-4829-a947-40cc1fbbb769`

## How backups work on this computer
Git Credential Manager holds the owner's GitHub sign-in, so **Claude pushes automatically after every commit**.

## Local running
The dev server runs from the Claude desktop preview (`.claude/launch.json` in `Documents\claude`) at http://localhost:3000.

## Director's improvements list (received 2 October 2026; since built, see the sections below)
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

## Quick-add customer from quotes and invoices (5 October 2026), done and tested
- In the customer search on quotes, orders, invoices, credit notes and recurring invoices: when typing, the list ends with **"+ Add '…' as a new customer"** (also shown when nothing matches). It's only shown to people with Customers edit permission.
- It opens an inline form inside the quote form (not a nested form): company name (pre-filled), phone, postcode, company email, and an optional main contact (first and last name, email, phone). Enter saves the customer, not the quote.
- Server action `quickAddCustomer` (customers/actions.ts):
  - validates the input
  - warns if the same name already exists (ignoring capitals), offering "Use the existing customer" or "add anyway"
  - sets the account owner to the person adding
  - makes the contact primary
  - logs "Customer added from a quote or invoice by …" on the timeline
- Tested with made-up "Seaview Test Bakery" (contact Sam Example): the customer was selected, the FAO filled in, the duplicate warning worked, and the customer page shows the details and the timeline entry.

## Possible duplicate customers flagged (5 October 2026), done and tested
- Migration `20261010120000_duplicate_customers.sql` (applied to test) adds:
  - generated `customers.name_key` (lower case, no punctuation or spaces, without ltd/limited/plc/llp/llc/inc/co/company/the/and/uk), `phone_key` (last 10 digits), `email_key`
  - table `customer_not_duplicates` (pairs checked as different)
  - views `customer_duplicate_pairs` and `customers_with_flags` (`has_duplicate`), both security invoker
  - `find_matching_customers(name, phone, email)`
- Shown in:
  - the Customers list: "Possible duplicate" tag and a "Possible duplicates only" filter
  - the customer page: amber warning listing matches and reasons, with a "Not a duplicate" button (customers edit)
  - quote/invoice customer search: tag
  - quick-add: now warns on the same name, phone or email
- Tested on test data: 59 flagged (the fake data repeats names); "Copse Joinery" matches "Copse Joinery Ltd"; Not-a-duplicate removes the pair; "Seaview Test Bakery Ltd" is caught as an existing customer.
- Later idea: a "merge these two customers" tool. It needs care (moves quotes, invoices, contacts and so on), so ask the owner first.

## Real products from Zoho, plus a product dropdown on quote lines (5 October 2026), done and tested
- The owner approved copying the real product list now (decision 5 October 2026). Imported from Zoho Books (`/api/v3/items` via the signed-in session) straight into the TEST database:
  - **135 products** (134 active), 132 with product numbers; suppliers matched or added (19 suppliers now)
  - the 12 made-up products (zoho_id FAKE-…) are marked not for sale
  - the data is not in the repo; the steps are in `docs/runbooks/IMPORT-PRODUCTS.md` and `supabase/seed/import-zoho-products.sql`, and are written as one statement because the Supabase SQL editor drops temp tables between statements
- Migration `20261011120000_product_codes.sql` (applied): `product_code` on sales_document_lines, recurring_invoice_lines and purchase_order_lines. The `set_line_product_code` trigger fills it from products.sku, so it carries through every copy path (quote → order → invoice, recurring, POs) and is ready for the Xero sync.
- New `ProductDropdown` on quote, order, invoice, credit note, recurring and PO lines:
  - lists all products by name (number and price shown small); filter by name or number; arrow keys and Enter (Enter never submits the quote)
  - picking a product sets the description to "SKU – Name" (plus the product's own description), and the price, cost and VAT
  - the old `ProductSearch` was removed
  - `/api/search/products?all=1` returns all products (the API caps at 1,000 rows, fine for 135)
- Tested: 134 listed; filtering by name works; the description starts with the product number; prices, cost and VAT fill in; a saved test quote (QT-010185) has the product_code on its line.

## Duplicate warning while typing a new customer (5 October 2026), done and tested
- The owner wanted: typing a new customer's name flags possible duplicates; clicking opens a box listing them; choosing one leaves the new-customer page and opens that customer. NOT a dropdown on the quote customer box (a dropdown attempt was undone).
- Migration `20261012120000_possible_duplicates_while_typing.sql` (applied): `possible_duplicate_customers(name, phone, email)`. Matches:
  - same name key
  - "similar name": contains the typed text (3+ letters), name-key prefix, or pg_trgm similarity ≥ 0.5 for typos (5+ letters)
  - same phone, same email
  - strongest first, up to 20
- `/api/customers/possible-duplicates`; `src/app/(app)/customers/DuplicateCheck.tsx`:
  - a flashing warning button opens a dialog (portal) with the matches and reasons
  - "None of these: carry on" dismisses it
- New customer page: `NewCustomerDuplicateWatcher` under the Name box; picking a match opens that customer.
- Quote quick-add box: the same check; picking a match puts that customer on the quote.
- Tested: "cop" → 5; "Copse Joinry" → 4; "Seaveiw Test Bakery" → 1; a new name → none; picking "Copse Joinery Ltd" opened its page; from a quote, picking a match set the quote's customer.
- Note: the test database has a customer literally named "cop" (probably the owner testing on live).

## Sales accounts on products (5 October 2026), done and tested
- Zoho Books item → sales account (`account_id` → chart of accounts). In Zoho the account *names* are the codes (4010…); the descriptions give the meaning (Print Outsource…). These are the Xero account codes.
- Migration `20261013120000_sales_accounts.sql` (applied):
  - `sales_accounts` (28 income accounts from Zoho's chart of accounts: code and cleaned name)
  - `products.sales_account_code` (FK)
  - `account_code` on sales_document_lines and recurring_invoice_lines, filled by the `set_line_account_code` trigger from the product (typed-in lines left blank; Xero sync will fall back to the customer's or default account)
- All 135 Zoho products were given their account through a zoho_id → code update (data via clipboard, not in the repo). Split: 4010:50, 4005:29, 4006:24, 4008:12, 4011:9, 4009:6, 4004:2, 4002:1, 4012:1, 200:1. Existing product lines back-filled.
- UI:
  - the Products list has a "Sales account" column
  - the product form has a Sales account select ("code – name"); "SKU / code" is renamed "Product number"
  - `saveProduct` saves `sales_account_code`
- The import template and runbook now include `ac` (account code).
- **Now live (5 October 2026, after the owner added Netlify credits):** PR #12 merged as ce4e6e4 and published. Earlier note: PR [TobyJacobs/Footprint-CRM#12](https://github.com/TobyJacobs/Footprint-CRM/pull/12) is open, NOT merged. On 5 October 2026 Netlify said **"Production deploys are paused because your team has used all of its available credits for this billing cycle."** The last live version is c5b5fa8 (PR #11). The database changes are already applied, so the live site keeps working; it just doesn't show the new Sales account fields.
- Options for the owner: upgrade the Netlify plan, wait for the credits to reset, and/or cut usage (turn off deploy previews and batch changes into fewer releases; each PR currently builds twice).

## Netlify usage (5 October 2026)
- The owner is on Netlify's **Personal plan ($9/month)**. Credits ran out after about 12 releases in one day; the owner added credits.
- From now on: **bundle several changes into one release** and check them locally first, instead of publishing each small change. Check the usage breakdown before turning off deploy previews.

## Staff activation with invites, licensed users only (5 October 2026), built and tested, NOT live yet (bundling)
- The admin consent for User.Read.All has been granted. The first sync (5 October 2026) found 50 accounts; 46 had no job title.
- Owner request: only licensed users; everyone deactivated; admins press Activate, which sends an invite link; staff then sign in themselves.
- Graph sync now selects `assignedLicenses` and skips unlicensed accounts. Re-sync: **41 licensed staff** (38 with no job title; titles seen: Digital Marketing Manager, Operations Administrator, Operations Manager).
- Migration `20261014120000_staff_activation.sql` (applied to test):
  - staff_directory gains activated, activated_at/by, invite_token, invited_at, joined_at
  - `_apply_directory_access` sets profile.is_active = activated AND enabled AND in Entra (never touches admins)
  - `handle_new_user` makes new profiles inactive unless they're the first admin or activated
  - functions: `activate_staff`, `deactivate_staff` (admin only; won't deactivate admins or self), `get_staff_invite` (public, first name only), `mark_staff_joined` (called in /auth/callback)
  - every directory entry was reset to not activated
- UI:
  - Admin → Users: status badges (Not activated / Invited / Active / Off in Microsoft 365) and an inline **Activate** button (not shown for admins)
  - person pages: `StaffAccessCard` with Activate and send invite, Resend invite, Deactivate, and a copyable invite link
  - the "Active" checkbox is hidden for directory staff
  - public `/invite/[token]` welcome page with Sign in with Microsoft
  - the login message for inactive users explains activation
- Invite email via Postmark when configured, otherwise the link is shown to copy.
- Tested: activate → Invited, test-mode email, link page "Welcome, Alex"; deactivate → Not activated, link invalid; a fake link is invalid.
- `netlify.toml` gets an `ignore` rule so docs/seed/markdown-only changes don't build (saves credits).
- To do at release: put `ENTRA_TENANT_ID`, `ENTRA_CLIENT_ID`, `ENTRA_CLIENT_SECRET` (owner pastes), `STAFF_EMAIL_DOMAINS` and `DIRECTORY_SYNC_KEY` (created in Admin → Microsoft 365, owner pastes) in Netlify; set up Postmark for real invite emails.

## Microsoft 365 sync live (5 October 2026)
- PR #13 (staff activation) live as e92dacb.
- Netlify env vars added: ENTRA_TENANT_ID, ENTRA_CLIENT_ID, STAFF_EMAIL_DOMAINS (by Claude); ENTRA_CLIENT_SECRET (pasted by the owner, marked secret).
- The first rebuild FAILED on Netlify's secret scanning: the client secret's value was found in Next.js's private Turbopack build cache (`.netlify/.next/cache/turbopack/*.sst`), which is never published. Fixed with `SECRETS_SCAN_OMIT_PATHS = ".netlify/.next/cache/**"` in netlify.toml (2dae56d, pushed straight to main to save a preview build). Published fine.
- "Sync now" on the live site: 41 staff found.
- Still to do: daily sync key (Admin → Microsoft 365 → Create sync key, then the owner pastes it into Netlify as DIRECTORY_SYNC_KEY, secret); Postmark for real invite emails; job titles in Microsoft 365 (38 of 41 blank) or switch to groups.

## Roadmap and requests (5 October 2026), built and tested, NOT live yet (bundled with the next release)
- Branch `feature/roadmap`. Owner request: an Admin tab listing every wave with status and tasks that tick off; management can send bugs/suggestions; admins approve/deny/query; approved items become roadmap tasks; "See old requests".
- Migration `20261015120000_roadmap.sql` (applied to test):
  - tables roadmap_waves (12: 0, 0+, 1, 2, Staff, 3 to 8, Final), roadmap_tasks (71, pre-ticked for what's built, 29 done), feedback_requests, feedback_comments
  - new permission "roadmap" (view), given to Directors; admins always have it
  - RLS: roadmap visible to admins and the roadmap permission; people see their own requests, admins see all; only admins decide, tick tasks or edit
  - triggers: ticking a task stamps who and when; ticking a request's task marks the request done; a reply to a query sends it back to review
- App:
  - `/roadmap` (menu item "Roadmap", also an Admin tab): overall progress; per-wave status (Done / In progress / On hold / Not started) with bar and checklist; admins tick tasks, add tasks and put a wave on hold; a side box "Send a suggestion or bug" (type, title, details, wave, page); "Your requests"; admins get "Requests to review" with Approve (picks wave and task name, becomes a roadmap task), Query (ask a question; the sender replies) and Deny (needs a reason)
  - `/roadmap/requests` ("See old requests"): approved, done and denied, with filters
- Tested end to end with test requests (since deleted): send → query → reply → approve → task appears on Wave 2 → tick → request becomes Done in old requests; deny → shows under Not going ahead.
- For Claude: to see what to build next, read approved requests and un-ticked tasks (`roadmap_tasks where not done`, especially `request_id is not null`), and tick tasks off as work finishes.

## Requests moved to their own page inside Roadmap (5 October 2026), built and tested, NOT live yet
- Branch `feature/requests-tab`. Owner request: keep the Roadmap page tidy by moving received requests to a separate page.
- Roadmap now has tabs (`RoadmapTabs`): Roadmap | Requests to review (admins only, with a count badge) | Old requests.
- New `/roadmap/review` (admin only): "Waiting for a decision" and "Waiting for the sender's answer" lists, with Approve / Query / Deny. These actions now return to this page.
- The Roadmap page keeps the checklist, the send box and "Your requests", plus a yellow banner for admins: "N requests waiting for your decision → Review".
- Tested: tabs and badge, banner, the review list, deny returning to the review page; test request deleted. Two "i want beers" requests on the test database were sent by the owner; left alone.
- Also on `feature/requests-tab`: admins get a delete (bin) button on every roadmap task, with an "Are you sure?" check (`deleteRoadmapTask`). Tested by adding and deleting a throwaway task. The owner had approved the test request "i want beers" on the live site, which became a Wave 5 task (the live approve flow works); the owner can delete it with the new button.

## Roadmap tidied (5 October 2026), built and tested, NOT live yet
- Branch `feature/roadmap-tidy`. Each wave is now a collapsible row (summary: title, status badge, thin progress bar, done/total; a green "N approved requests to do" when there are any). Click to open its tasks. "Open all / Close all" buttons. After ticking, adding or deleting a task, or putting a wave on hold, the page reopens with that wave open (`?open=<waveId>`).
- Tasks that came from approved requests are shown in green (green icon, bold text, "(approved request)"), and struck through but still green once done.
- Tested with a test request approved into Wave 8: green row summary and task, tick keeps the wave open; test data deleted.
- Postmark set up the same day: the owner signed up, verified the sender toby@footprintgroup.uk (the Postmark account is in test mode; "Request approval" is needed before sending to customers); Netlify has POSTMARK_SERVER_TOKEN (secret, owner pasted) and EMAIL_FROM; rebuilt and published. Not yet tested with a real invite (the owner chooses who to activate).

## 5 October 2026 - Nine small details (branch feature/small-details, not yet released)
- Migration 20261016120000_small_details.sql applied to the TEST database.
- GP override on sales documents (admin or Operations dashboard users only, reason required, who/when recorded).
- "Quotes & Invoices" renamed "Sales & Operations".
- File and image uploads on roadmap requests (private bucket, 5 files, 10 MB each).
- Account owner / salesperson defaults to the signed-in user on new customer, quote, invoice, PO.
- New customer form: no services, ownership or description; Status Active/Cancelled; "Account type" uses Zoho's 20 values; "Heard about us" is a dropdown.
- Services tick automatically from sales orders (account code and product-name rules); shown on the customer card.
- Email templates: 6 starter templates, composer on the customer card (send via Postmark or open in own email app), admin editor at Admin > Email templates.
- Checked: build, type-check and lint clean. NOT yet clicked through in a browser (sign-in is Microsoft only).

## 6 October 2026 - Renamed to FootprintOS (LIVE)

- Product name is now **FootprintOS** (sub-brand of Footprint Group): page titles, login, invite, welcome heading, GDPR export wording, sidebar wordmark under the logo, and the docs.
- Build, type-check and lint clean. Not clicked through in a browser.
- **Still manual for the owner:** rename the Entra app, the Supabase project, and the Netlify site. Renaming the Netlify site changes the address (footprinthub.netlify.app becomes footprintos.netlify.app), so first add `https://footprintos.netlify.app/**` and `https://*--footprintos.netlify.app/**` to Supabase redirect URLs, change the Site URL, and update any `NEXT_PUBLIC_SITE_URL`-style Netlify variable. Keep the old entries until the new one works.
- Also: `EMAIL_FROM` display name (Netlify env var) and the Postmark sender name.

## 6 October 2026 - GP override is now per line (LIVE)

- The "Override GP" button moved from the whole quote/order/invoice to **each line**. Operations/admins set the line's gross profit and a reason; the line shows its GP (and an "overridden" mark), and the document cost is the sum of line costs.
- Needs migration `20261017120000_line_gp_override.sql` run in the Supabase SQL editor (adds line override columns, recalculates `line_cost`, retires the document-level trigger, adds `copy_line_overrides`, updates the accepted-quote-to-order function).
- Saving a document now updates existing lines in place (instead of delete and re-insert) so overrides survive edits. Overrides carry over when converting a quote to an order or invoice.
- The old document-level override columns are left in the database but unused; any document-level override set earlier is dropped (the test data had none known).
- Migration applied to the test database and verified on 6 October 2026. Build, type-check and lint clean. Not clicked through in a browser.
## 6 October 2026 - Netlify site renamed

- Netlify project renamed `footprinthub` to **`footprintgroupos`**. The live address is now **https://footprintgroupos.netlify.app**. The old footprinthub address no longer works.
- Supabase redirect URLs now include `https://footprintgroupos.netlify.app/**` and `https://*--footprintgroupos.netlify.app/**`. The old footprinthub entries were **removed on 6 October 2026** after the owner confirmed Microsoft sign-in works on the new address. Supabase now lists only localhost and the two footprintgroupos entries.
- The login page loads on the new address and shows FootprintOS. The owner confirmed a full Microsoft sign-in works there.
- No Netlify environment variable held the site address, so none needed changing.

## 7 October 2026 - Wave 3: Projects & Time screens built

- The Wave 3 **database** was already built and applied to the test database on 5 October (migration `20261009120000_projects_time.sql`, from branch `wave-3/projects`, now brought into `main`). It has projects (FO- numbers), tasks by stage, templates, time logs with a timer, staff cost rates, and a trigger that makes a project for every new sales order. 18 projects and 180 tasks already existed from back-filling test orders.
- This release adds the **screens** on that design (owner approved "use the defaults, build it" on 7 October):
  - `/projects`: list (search, status, group, only mine); new and edit (with optional template); project page with tasks by stage (status, assignee, add, delete), timer start/stop, typed-in time, time log, staff time cost (only for admins, directors and finance), link to the sales order and customer.
  - `/projects/time`: my weekly timesheet and any running timer.
  - `/projects/reports`: time by project and person.
  - `/projects/templates`: edit templates and their steps.
  - `/projects/rates`: staff cost rates (admins only). The default £25/hour is still a made-up example.
  - A Projects card on each customer page.
- Permissions migration `20261018120000_projects_permissions.sql`: Sales and Finance can view and edit; Directors can also delete (delete = correct anyone's time, delete projects).
- Everyone with Projects access sees all projects and all time logs (that is how the earlier design works). Only your own time can be deleted unless you have delete.
- Not yet: Zoho Projects import (needs an export), billing from hours, time widgets on dashboards, back-fill of cost rates.

## 12 October 2026 - Projects pipeline and task estimates

- Owner asked for the Projects section to work like a pipeline, with an estimated time on every task ("for now").
- `/projects` now opens on a **Pipeline** board (a List view is one click away). Each project sits in the column for the stage of its first unfinished task; "No tasks yet" comes first and "All tasks done" last. Inside a column the most urgent job is first: overdue, then soonest due. Cards show the next task, due date, progress, and time logged against the estimate (red when over).
- Estimates: migration `20261019120000_task_estimates.sql` adds `estimated_minutes` to tasks and template steps; new projects copy the estimate from their template. Typed in as hours on the project page and the templates page. Project page shows logged vs estimated per task, per stage and for the project.
- Applied to the test database on 12 October. Also applied to the live London database on 12 October, with my estimates for all 29 template steps. Not yet clicked through in a browser (needs a Microsoft sign-in).
- Not built: timers that start by themselves (would record hours nobody worked); a "My work" list across projects (offered).

## 13 October 2026 - Switched email from Postmark to SendGrid (SENDGRID_API_KEY saved in Netlify; staff invites are the first use)

- Code swapped (`src/lib/email/sendgrid.ts`), wording updated, `.env.example` updated. Build/type-check/lint run before release. Not tested with a real send: needs the SendGrid key and a verified sender first (see DECISIONS.md).
- **14 October 2026: SendGrid confirmed working.** The owner set it up, sent a real invite to a colleague, and the colleague received it and can sign in to FootprintOS.

## 14 October 2026 - Roadmap check and tidy-up

- The owner's Claude app is now signed in as a different Claude account (personal iCloud). The project, GitHub, Netlify and Supabase are unaffected. The owner's Chrome (Claude in Chrome) is connected to this account.
- Supabase organisation "Footprint Group - CRM" (Pro plan) has two projects: **FootprintOS - Live** (London, eu-west-2, ref `khjcplhuenureeobvzqo`) and **Footprint Platform – Test** (Frankfurt, ref `ifspqkcdatruybgzygic`). The live roadmap is on the Live project. Earlier notes said the live database was "on hold"; it does exist (creation date not recorded in these notes).
- Live roadmap: no approved requests. The test database has a joke request ("i want beers"), ignored.
- **IMPORTANT: the live website (footprintgroupos.netlify.app) still uses the TEST Supabase project (Frankfurt, `ifspqkcdatruybgzygic`).** Proof: the daily Microsoft 365 sync (a Netlify scheduled function calling the site) writes its runs there, and today's sign-ins are there. The London "FootprintOS - Live" project exists but nothing uses it yet. Real staff data from Microsoft 365 is in the test project. Moving the site to London is a planned cut-over job for later, with the owner.
- **Daily Microsoft 365 sync: working.** It has run automatically at 05:00 UTC every day since 7 October 2026 (43 staff each time). Ticked off.
- Roadmap tidied on the TEST project (the one the app shows), verified: 9 tasks ticked (including the daily sync and the Roadmap page), Postmark renamed to SendGrid, Wave 3 active. The same tidy-up was also run on the unused London project.
- Owner's request (14 October 2026): the customer import and the move to London belong in the final Go-live stage. On the test roadmap, "Import all ~15,000 customers from Zoho (at go-live)" moved from Wave 1 to Final, and a new un-ticked Final task was added: "Move the website to the London database" (rehearse the copy first, the owner signs in first because the first sign-in becomes admin, keep test as a fallback). Every Wave 1 task is now ticked. "Import quote and invoice history from Zoho (at go-live)" also moved from Wave 2 to Final, so all Zoho imports sit in Go-live. On 15 October 2026 the owner asked for every import and switch-off task to sit in Go-live: also moved "Import projects and time from Zoho Projects" and "Switch off Zoho One" (from Wave 3), "Import from monday.com" (Wave 4) and "Import from Mag Manager" (Wave 5). The owner also chose to move "Choose a password manager and move passwords from Zoho Vault" and "Move team chat from Zoho Cliq to Microsoft Teams" (stage 0+, now with no open tasks) and "Run alongside Zoho for one billing cycle" (Wave 2).
- Moving to London does NOT carry data over by itself: roles given by hand, teams, products, quotes, invoices, projects and the roadmap must be copied; logins and the staff list rebuild themselves; the sync key and Netlify settings need redoing.
- **Marketing team role** (migration `20261020120000_marketing_role.sql`, applied to test 14 October): customers view, projects view+edit, design/marketing/hub view. Job title rules: Marketing, Social Media, Content, Design. Only 3 of 43 staff have job titles; the owner will fill them in in the Microsoft 365 admin centre.
- **Marketing team workspace** (new roadmap stage "3+", branch `feature/marketing-workspace`, PR [TobyJacobs/Footprint-CRM#24](https://github.com/TobyJacobs/Footprint-CRM/pull/24), 15 October 2026). Owner chose: overview with my work + retainers board, content calendar, ad campaigns tracker, and marketing templates; Footprint's own email/SMS stays in Wave 8.
  - `/marketing`: my open tasks, my content due in 14 days, live retainers board (content ready vs monthly quantity of Social Media Content/Blog Posts/Case Studies/Email Marketing; hours from time logged on the client's "Marketing Retained" projects vs budget_hours; running campaigns).
  - `/marketing/content`: month grid and list, filters, quick status change. `/marketing/campaigns`: spend vs budget with pace marker ("ahead" = spend share more than 10 points ahead of time share).
  - Migration `20261021120000_marketing_workspace.sql`: tables `content_items`, `ad_campaigns` (marketing permission RLS, audit), Marketing team + Directors get marketing edit/delete, 4 templates (Monthly social media, Ad campaign launch, Website and blog content, Email campaign). Applied to the TEST database 15 October 2026 (live site uses it). Not yet applied to London.
  - Build, type-check and lint clean. NOT yet clicked through in a browser (needs the owner's Microsoft sign-in on the preview).
  - **LIVE 15 October 2026:** the owner merged PR #24 (squash, `a7937b8`). All four "Marketing team workspace" roadmap tasks ticked.
- **Marketing home page** (15 October 2026, branch `feature/marketing-home`, PR [TobyJacobs/Footprint-CRM#25](https://github.com/TobyJacobs/Footprint-CRM/pull/25)): new dashboard type `marketing` (my tasks, content due in 7 days, waiting for client approval, live campaigns needing a look). The home page now checks access per dashboard (marketing needs Marketing view; the others still need quotes view). Migration `20261022120000_marketing_home_page.sql` (allows `marketing` in `roles.dashboard`, sets the Marketing team role to it) applied to TEST 15 October. Roadmap task "Marketing home page, like the other roles" added to the Staff stage. **LIVE 15 October 2026** (owner merged PR #25, `eff4618`); roadmap task ticked.
- **Dashboards section (Wave 3)** (15 October 2026, branch `feature/dashboards`, PR [TobyJacobs/Footprint-CRM#26](https://github.com/TobyJacobs/Footprint-CRM/pull/26), **LIVE 15 October 2026**, owner merged as `8181668`; the four "Dashboards:" roadmap tasks are ticked. Wave 3's only open building task now: "Staff cost rates and profit after time"). Owner chose all four tabs, access by role, and Claude's judgement on contents.
  - `/dashboards/revenue`: invoiced (net, after credit notes, which also take off their cost) and gross profit by month against the same months last year, by account manager, by sales account, top 10 customers. Period 3/6/12/24 months, person filter for people who see all sales.
  - `/dashboards/pipeline`: open quotes (value, count, past valid-until), win rate, won/lost by month and person, average days quote → win (online acceptance, else first order date), open quotes by age, biggest open quotes, reasons for losing.
  - `/dashboards/renewals`: recurring invoice bills expected in 30/60/90 days (walks each schedule forward), next bills, hosting renewals by `renewal_month` for this and the next two months, live/paused retainers, recurring invoices ending soon, and anything cancelled/stopped in 90 days (dated by `updated_at`, approximate).
  - `/dashboards/time`: hours by person/customer/project, billable %, finished jobs' estimated against actual (all their time).
  - Access (`src/lib/dashboards/analytics.ts` `allowedTabs`): Revenue + Pipeline for director/finance/sales home-page roles with quotes view; Renewals for director/finance/admin; Time for projects view. Database rules still restrict sales staff to their own documents.
  - Migration `20261023120000_dashboards.sql`: `dashboard_revenue` and `dashboard_pipeline` (security invoker), and `dashboards:view` for Sales, Finance, Operations and Marketing teams. Applied to TEST 15 October and smoke-tested. Build, type-check and lint clean.
- **Profit after time** (15 October 2026, branch `feature/profit-after-time`). Owner chose hourly costs **per role**, made-up figures for now, and asked Claude to check Zoho for real staff rates. Zoho check NOT done: the owner's Chrome (now linked to the new Claude account) isn't signed in to Zoho, and on 15 October the owner said to leave it for another day (see OPEN-QUESTIONS). Example rates stay until then.
  - Migration `20261024120000_profit_after_time.sql`: `role_cost_rates` (example rates: Directors £45, Finance £26, Sales £24, Marketing £24, Operations £22); `person_hourly_cost()` = highest rate of the person's roles, else company default; `project_time_costs` now uses role rates (per-person `staff_cost_rates` no longer used); `project_profit(project_ids)` = invoiced from the sales order's invoices less credit notes (or the order value if nothing invoiced yet) − materials (cost_total) − staff time. Only admins, directors and finance get rows. Applied to TEST 15 October.
  - Screens: Projects → Cost rates is now per role (examples marked); project page shows a "Profit after time" breakdown; Dashboards → Time adds a profit tile and a profit column on finished jobs (cost viewers only).
  - **LIVE 15 October 2026** (PR [TobyJacobs/Footprint-CRM#27](https://github.com/TobyJacobs/Footprint-CRM/pull/27), owner merged as `57d8f7b`). Roadmap task ticked: **every Wave 3 building task is now done**; Wave 3's remaining items (Zoho Projects import, switch off Zoho One) sit in Go-live.
- **Smoother feel** (PR [TobyJacobs/Footprint-CRM#28](https://github.com/TobyJacobs/Footprint-CRM/pull/28), **LIVE 15 October 2026** as `bbd8611`, confirmed in the live stylesheet). Unlayered CSS in `src/app/globals.css` (hover lift on `a.rounded-lg.border` boxes, button press, smooth transitions, progress bars fill from empty, menu slide, pink focus ring, all off under prefers-reduced-motion) plus `src/app/(app)/template.tsx` (page fade-in on section change). Roadmap task in stage 0 ticked.
  - Tip: when a PR sits on "Checking for the ability to merge" after another merge, merging main into the branch and pushing un-sticks it.
  - The browser pane is shared with the owner: always pass `tabId` to browser actions, or clicks/typing can land in the owner's tab.

- **Speed** (15 October 2026, branch `feature/faster-clicks`): the owner said clicks feel slow. Measured: even /login takes 0.6–1.2s to first byte. Causes: (1) no loading screens, so nothing shows until the server answers; (2) **Netlify functions run in Ohio (CMH, US East) while the database is in Frankfurt** — every database trip crosses the Atlantic; Netlify says "Upgrade to customize region" (needs a paid plan — owner's decision; pick Frankfurt now, London once the database moves); (3) every page re-checks the login with Supabase over the network. Built: `loading.tsx` skeletons for (app) and each section with a layout, `src/components/PageSkeleton.tsx`, `src/components/ActivityBar.tsx` (top progress bar + spinner on the button that submitted a form), `getCurrentUser` now uses `auth.getClaims()` (local check once Supabase "JWT signing keys" are switched on — a separate, careful step with the owner). **LIVE 15 October 2026** (PR #29, `144403c`, confirmed in the live stylesheet); added to the roadmap (stage 0) as a ticked task.

- **Zoho customer count (15 October 2026): 17,215 Accounts** in Zoho CRM (not ~15,000), 328 names appear more than once. The owner asked for a names-only spreadsheet; it was saved on the owner's computer (Documents) only, never in the repo. Zoho CRM's internal API works from the signed-in Chrome tab with headers X-ZCSRF-TOKEN: crmcsrfparam=<crmcsr cookie> and X-CRM-ORG: 20091739281 (read only, page_token paging past 2,000).

## Next (as of 15 October 2026)
- Owner's to-dos: Microsoft 365 job titles (the director is filling them in; the owner will say when done, then Claude runs/reads the sync and reports who matched a role and who didn't); sign in to Zoho in Chrome so Claude can look for real hourly rates; turn Auto mode off in Settings → Claude Code.
- Suggested next builds: GoCardless Direct Debit, Xero sync (Wave 2), real targets and commission (Staff), then Wave 4 Design Workload. **The owner wants GoCardless and Xero left for later** (15 October 2026).
- **Click-through test DONE 15 October 2026** (owner signed in as Toby, admin, in Claude's built-in browser; nothing saved). Results: all 53 section pages and 22 detail/edit/print pages load (200, no error pages); a scan for NaN/undefined/Invalid Date/[object Object] found none except the Audit log showing raw JSON; figures consistent (pipeline £7,100 / 6 open quotes on home and Dashboards; profit after time on FO-1501 correct: £3,590 − £1,436 − £0 = £2,154, 60%); phone width fits (no page-level sideways scroll). Timings 0.7–1.3s per page, Staff hub 1.8s. Findings for the owner: (a) tasks/content/campaigns can only be assigned to people who have signed in (5 of 43 staff); (b) Audit log shows raw technical data; (c) content calendar month grid needs sideways scrolling on phones (list view would suit phones); (d) Staff hub is the slowest page; (e) one unexplained 404 in the console on page load (nothing visibly missing). Not tested: saving forms, other roles' views, real email sends. NOTE for testing: when Claude's browser pane is hidden, streamed pages stay on the loading outline because animation frames don't run — not a real bug; read the hidden `S:n` divs or show the pane.
- **Health-check fixes (15 October 2026)**, owner asked to sort all findings:
  - Batch 1, PR [TobyJacobs/Footprint-CRM#30](https://github.com/TobyJacobs/Footprint-CRM/pull/30), migration `20261025120000_database_tuneup.sql` (generic, re-runnable): RLS policies wrap auth.uid()/auth.jwt() as (select …) (10 policies); an index on every single-column foreign key (51 added); EXECUTE revoked from public/anon/authenticated on all trigger functions; `sales_stats` and `team_month_stats` now subtract issued credit-note cost. Applied to TEST and re-checked (pages load; Sales Overview margin 59.8% = Dashboards). Junk "i want beers" requests (3) deleted from TEST. Remaining Security Advisor warnings are intentional (token links, staff invites, key-checked directory_sync_apply, app helper functions).
  - Batch 2, branch `feature/polish-batch2`: Staff hub fetches all months in one RPC (`team_stats_history`, migration `20261026120000_staff_hub_speed.sql`, applied to TEST, verified identical to team_month_stats); readable Audit log (friendly table/field names, people's names for IDs, Yes/No, dates); content calendar opens in list view on phones (`PhoneListView`); content/campaign items viewable with Marketing view (read-only details), form only with edit; "Only staff who have signed in are listed" notes on people pickers; **Preview as role** for admins (Admin → Roles; cookie `fp_preview_role`, only honoured for real admins, banner with Stop preview; records aren't filtered).
  - #10 (assign to all 43 staff) is a process fix: people without a sign-in have no profile (profiles.id references auth.users). Once job titles are in, invite staff from Admin → Microsoft 365; after one sign-in each, they appear in every picker.
  - **Both batches LIVE 15 October 2026** (owner merged #30 as `511da4f` and #31 as `6ea2fb7`). Checked live: Audit log readable, Preview as role button present. Found the first team_stats_history made the Staff hub slower (2.8s: months ran one after another); replaced with a one-pass version (migration `20261027120000_staff_hub_one_pass.sql`, applied to TEST, identical to team_month_stats for 6 months; hub now ~1.2s) and the Audit log now names roles — PR [TobyJacobs/Footprint-CRM#32](https://github.com/TobyJacobs/Footprint-CRM/pull/32), **LIVE 16 October 2026** (owner merged as `cd79893`). Roadmap stage 0: four ticked tasks added for the test, tune-up, polish and preview-as-role.
  - Still waiting on the owner: #5 backup restore test (temporary extra database, may cost a little), #8 Sentry (sign in to Sentry in Chrome), #9 real targets and commission (figures).
- (Done) **#1 full click-through test.** The owner will sign in with Microsoft in Claude's built-in browser (footprintgroupos.netlify.app/login, admin account if possible) when home. Plan: open every page and form (no saving without asking; any test record clearly labelled and deleted), check desktop and phone sizes and console errors, write up findings, fix what the owner approves.
- Quality backlog found 15 October 2026 (owner to pick): (2) database speed tune-up — Supabase Performance Advisor: 25 warnings, mostly "Auth RLS Initialization Plan" (wrap auth.uid() as (select auth.uid()) in policies: user_roles, monthly_targets, commission_rules, time_logs, feedback_requests…), plus 65 suggestions (likely unindexed foreign keys); (3) permissions tidy — Security Advisor: 54 warnings, SECURITY DEFINER functions executable by anon/signed-in users (trigger functions like audit_row, stamp_roadmap_task, feedback_reply_reopens should be revoked; token functions get_quote_by_token, respond_to_quote, get_public_document, get_staff_invite and key-checked directory_sync_apply are intentionally public); (4) old sales stats (sales_stats, team_month_stats) don't subtract credit-note cost, so margins differ from the new Dashboards; (5) test a backup restore; (6) view-only access to content/campaign items; (7) remove junk test data (e.g. "i want beers" request); (8) check Sentry errors; (9) real targets and commission.
- **Merging:** Claude Code's automatic safety check blocks Claude from merging pull requests (and from loosening its own rules), even after switching out of Auto mode within the same session. The owner clicks "Squash and merge" on GitHub. The owner is turning Auto mode off in Settings → Claude Code; in a fresh session, try merging with an Allow prompt.
- Personal permission settings in `.claude/settings.local.json` (not on GitHub): reading pages, git status/commit, build/lint and code edits don't prompt; clicking/typing in browsers (so database changes) and git push still ask.
- London roadmap tidied (done by Claude with the owner's approval, read back and verified): renamed the Postmark task to SendGrid; ticked off the platform name, the four Projects screen tasks, the live database and SendGrid emails; took Wave 3 off hold.
- Claude Code's **Auto mode** blocks Claude from writing to the live database. Use **Ask permissions** mode for live SQL: the owner approves each change on a prompt.
- Still open after the tidy-up: Zoho Projects import, profit after time, daily Microsoft 365 sync key, job titles for automatic roles, real targets and commission, GoCardless, Xero sync, Waves 4–8, go-live tasks.

## 16 October 2026 - Health-check PR live; quote flow confirmed by the owner
- PR [TobyJacobs/Footprint-CRM#33](https://github.com/TobyJacobs/Footprint-CRM/pull/33) **LIVE 16 October 2026** (owner merged as `f3ae8e9`): emails to several addresses, safer after-login return links, GDPR exports stop if the audit log can't record them, three other actions report database errors.
- **The owner tested the quote flow on the live site, sending to themselves: "flows perfectly".** Sending to more than one address is now fixed too.
- The owner is on a new laptop. GitHub holds everything; `.env.local` and personal Claude settings must be set up again on it (not on GitHub by design). Cloud sessions can do code and pull requests but not Chrome, Supabase or the Roadmap ticks; those need Claude Code on the laptop with the Chrome extension (installed by the owner 16 October 2026).
- **The GitHub repository is public.** Claude recommended making it private (16 October 2026); waiting on the owner.
- Next suggested build: invoice safety (no moving issued invoices back to draft, no double conversion, mark issued only after the email is sent), then the British Summer Time follow-up fix. Full list of bigger issues in PR #33's description.

## 19 October 2026 - Invoice safety and UK time fix (branch `claude/charming-lovelace-5i9y13`, PR waiting for the owner)
- Owner asked for "the small but important ones". Built, NOT yet live:
  - **Status changes follow fixed rules** (`allowedMoves` in `src/app/(app)/sales/actions.ts`, matching the screen buttons): quote draft→sent→accepted/declined; order open→completed/cancelled; invoice draft→issued→paid/void; credit note draft→issued→void. An issued invoice can no longer be moved back to draft. Changes only apply if the status hasn't changed since it was read (two tabs).
  - **No double conversion:** the source quote/order is marked converted/invoiced *first*, only if still in an allowed status, so a double-click can't create two orders or invoices. Put back if creating the new document fails. Double-clicking "Raise credit note" can still make two *draft* credit notes (deletable; left as is).
  - **Failed email = still a draft:** the document is still issued just before sending (customer links refuse drafts), but if SendGrid fails it goes back to draft with its old sent date.
  - **UK time fix:** `dateTime()` in `src/lib/forms.ts` reads form times as Europe/London, so follow-up and timeline times no longer move an hour on each save in summer. Tested with a UTC server clock, including both clock-change days.
- Build, type check and lint clean. Not clicked through (no test database in the cloud session).
- **LIVE 19 October 2026:** owner merged PR [TobyJacobs/Footprint-CRM#34](https://github.com/TobyJacobs/Footprint-CRM/pull/34) (invoice safety + UK time fix) as `ec29b9f`.
- Margin showing 100%: explained to the owner (lines with no cost price count as £0 cost). **Owner decided (19 October 2026) to leave it as it is** — don't raise it again unless asked.

## 19 October 2026 - Wave 4 started: Design Workload (replaces monday.com)
- Owner's answers: jobs come from **sales orders, projects and ad-hoc requests**; **standard stages** (To do → In design → With customer → Amends → Approved → Sent to production → Done); **online proof approval now** (Part 4b); earlier monday.com replacement code not found, so built fresh. monday.com renewal date: asked, not yet answered.
- **Part 4a built** (branch `claude/charming-lovelace-5i9y13`, PR waiting for the owner):
  - Migration `20261028120000_design_workload.sql`: `design_jobs` (number DJ-1001…, brief, customer, sales order, project, designer, due date, high priority, stage, stage/finished stamps), `design_job_files` (proofs numbered v1, v2… automatically; brief files), `design_job_notes`; private storage bucket `design-files` (images and PDF, 25 MB). Permissions: Design view = see all jobs, raise jobs, add notes and brief files; edit = change jobs and add proofs; delete = delete jobs/files/any note. Marketing team + Directors: view/edit/delete; Operations: view/edit; **Sales team now gets Design view**. Applies to the TEST database automatically when merged (Supabase GitHub integration).
  - Screens: `/design` board (column per stage, "Move to …" button, late jobs flagged, done jobs shown for 14 days), `/design/list` (filters, include finished), `/design/mine` (assigned to me + jobs I asked for), `/design/new` (pre-filled from `?order=`, `?project=`, `?customer=`), `/design/[id]` (stage buttons incl. "Customer wants changes", brief, proofs with preview of the latest, uploader, notes, details form). A "Design jobs" card on sales order, project and customer pages.
  - Checks: build, type check, lint clean. Migration run on a temporary local PostgreSQL with Supabase stand-ins and permissions tested as salesperson, designer and no-access user (all as intended). Not clicked through in a browser.
- **Part 4b next:** online proof approval by the customer (private link, Approve / Request changes) and the monday.com import (owner exports the board as a spreadsheet).
- **Part 4a LIVE:** owner merged PR [TobyJacobs/Footprint-CRM#35](https://github.com/TobyJacobs/Footprint-CRM/pull/35) as `47c971a`. Not yet clicked through in a browser; roadmap tick still to do.

## 19 October 2026 - Wave 4 Part 4b: online proof approval (branch `feature/design-proof-approval`, PR waiting for the owner)
- Migration `20261029120000_design_proof_approval.sql`: table `design_proof_approvals` (one row per proof sent: private token, 30-day file link, sent to, status waiting / approved / changes / withdrawn, customer's name, comment, IP, time); `design_job_notes.from_customer`. Two functions open without sign-in, token only: `get_proof_by_token`, `respond_to_proof` (needs a name; "Request changes" needs a comment; only the latest, unexpired, unanswered link works).
- Customer's answer moves the job: Approve → Approved; Request changes → Amends (unless the team has already moved it further). It's added to the job's notes ("Customer (online)") and the customer's timeline.
- Customer page `/p/[token]` (added to the no-sign-in list in `src/proxy.ts`): shows the proof (image, or PDF in a frame, plus "Open full size"), then name + comments + Approve / Request changes.
- Job page: new "Customer approval" box. "Email proof for approval" (pre-filled with the customer's main contact, via SendGrid) or "Just make a link" to paste into your own email. Sends the newest proof; older waiting links are withdrawn; job moves to "With customer". History of every link with Copy link, "See what the customer sees" and Withdraw. If the email fails, the link is deleted.
- How the customer sees a private file without signing in: when sending, FootprintOS makes a 30-day private link to that one file and stores it with the request (see DECISIONS, 19 October 2026). No new secret keys.
- Checks: build, type check, lint clean. Database rules tested on a temporary PGlite database (21 checks: permissions, withdrawal of older links, answering once, expiry, stage moves, notes, timeline). **Not clicked through in a browser**: the test database only gets the new table when the PR is merged.
- **Merged 19 October 2026 by Claude** at the owner's request (PR [TobyJacobs/Footprint-CRM#36](https://github.com/TobyJacobs/Footprint-CRM/pull/36), `d740a7f`). Merging from a local session (not Auto mode) worked; earlier sessions were blocked.
- After merge: click-through (send a proof to yourself, approve and request changes), then tick the roadmap (Wave 4: "Design Workload: job board, files and notes" and "Design Workload: online proof approval").
- Still to do in Wave 4: monday.com import (owner exports the board as a spreadsheet); monday.com renewal date.
- Roadmap ticks needed (cloud session can't reach Supabase): add/tick "Design Workload: job board, files and notes" in Wave 4 once live.

## 19 October 2026 - Design tables were missing on the live site (fixed)
- Found during the Part 4b click-through: "Could not find the table public.design_jobs". Supabase's automatic update had **failed on every merge since 15 October 2026** ("content_items already exists"), because migrations `20261021…` to `20261027…` were applied by hand in the SQL editor but **not recorded** in `supabase_migrations.schema_migrations`. So Part 4a's tables never reached the database, and the Design section was broken live after #35 was merged.
- Fix (owner approved, done by Claude in Chrome): checked all seven really were in the test database, then recorded them in `schema_migrations`; pushed to `main` to re-run the automatic update for `20261028…` (Design) and `20261029…` (proof approval).
- **Rule from now on:** any migration applied by hand must also be recorded (`insert into supabase_migrations.schema_migrations (version, name) values (…)`). After every merge with a migration, check the "Supabase Preview" check on the merge commit passed: `gh api repos/TobyJacobs/Footprint-CRM/commits/<sha>/check-runs`.
- **Fixed and verified 19 October 2026:** the update on `77e296e` succeeded; `design_jobs`, `design_proof_approvals`, `respond_to_proof` and the `design-files` bucket are in the test database, and `20261021…` to `20261029…` are all recorded.

## 19 October 2026 - Part 4b click-through on the live site: PASSED
- Signed in as the owner (Toby, admin) in Claude's built-in browser; customer side tested signed out in Chrome.
- Test job **DJ-1001 "TEST - proof approval check (delete me)"** (no customer): uploaded generated test images v1 and v2.
- v1 **emailed to toby@footprintgroup.uk** (SendGrid, real send) → job moved to With customer, note added. Customer page showed message and proof without sign-in. **Request changes** with a comment → page thanked; job moved to **Amends**; "Customer (online)" note with the comment; history shows "Changes requested".
- v2 via **Just make a link** → "Link only (not emailed)", waiting. **Approve** → job moved to **Approved**; note "APPROVED proof v2 online". The answered v1 link still shows its own answer. A made-up link shows "Proof not found".
- Roadmap (Wave 4, test database): ticked "Design work items with status and priority", "Attach drafts and notes", "Link work to customers, orders and projects"; added ticked "Customers approve proofs online".
- Test job DJ-1001 **deleted 19 October 2026** at the owner's request, after they checked the test email (files, notes and approval links went with it). Note: job numbers carry on from DJ-1002.
- Seen during testing: anyone with a page open while a new version goes live gets "Something went wrong" on their next click (server action not found); a refresh fixes it. Possible later fix: Next.js deployment skew protection / a friendlier message.
- Wave 4 building work is complete. **Owner decided (19 October 2026): the monday.com board export and import wait until Go-live**; don't ask for the spreadsheet before then. (It's a list of design jobs, not customers; customers come from Zoho at Go-live.) monday.com renewal date: owner said (19 October 2026) it doesn't matter, no time frame needed; don't ask again.

## 19 October 2026 - Roadmap: backup restore test only at Go-live
- At the owner's request, deleted the Wave 0 task "Test restoring a backup" (test database roadmap): Go-live already has "Test restoring a backup of the live database", which covers it. Wave 0 now has no open tasks. Health-check item #5 (backup restore test) therefore happens at Go-live, on the London database with real data.

## 19 October 2026 - Health-check leftovers (branch `fix/health-check-leftovers`, PR waiting for the owner)
- **UK "today" everywhere:** new `src/lib/dates.ts` (`ukToday`, `ukMonth`, `addDaysTo`, `addMonthsTo`, `ukDaysFromToday`, `customerDueDate`). The shared helpers (`todayIso`, sales `addDays`, dashboards `isoDate`/`getMonth`/`recentMonths`, `getSalesStats`) and the direct spots (converting documents, new quote/invoice/PO/recurring pages, project template due dates, timer log date, quote expiry on `/q/`, GDPR export filename, renewals month) now use Europe/London. Tested with a UTC clock incl. just after midnight in BST and the clock-change day.
- **Customer payment terms:** invoices made from a quote/order, and a new invoice started from a customer, use the customer's `invoice_due_days` + `invoice_due_terms` (Zoho wordings: after bill date / after bill month / of the current month / of the following month); company terms if the customer has none. **Not changed:** recurring invoices still use the company's terms (made in the database; the health check wrongly said they used the customer's).
- **Staff sync key checked first:** migration `20261030120000_directory_sync_key_check.sql` adds `check_directory_sync_key`; `/api/cron/directory-sync` turns a wrong key away before contacting Microsoft. Tested on PGlite (5 checks).
- **Packages:** Next 16.4.2, React 19.3.1, Sentry 11.8, Supabase 2.118, Netlify plugin 5.16.3, lucide 1.59, @types/node 24 (matches Netlify's Node 24). Skipped on purpose: TypeScript 7, ESLint 10. `npm audit`: 0 vulnerabilities.
- **Access checks:** Projects and Marketing pages already check themselves; the Design board, list and My jobs now do too.
- **Console 404 from the click-through:** not reproduced on home, customers, quotes, design or projects (no failed requests). Probably an old-release mix-up, which #37 now handles.
- Checks: build, type check, lint clean. Not yet checked on the live site.
- **LIVE 19 October 2026:** merged by Claude at the owner's request (PR [TobyJacobs/Footprint-CRM#38](https://github.com/TobyJacobs/Footprint-CRM/pull/38), `ebbafc6`). Supabase update on the merge commit: **success**. Live deploy went out 14:03 BST.
- Checked live (nothing saved): wrong staff-sync key refused in 0.9s; new invoice for Hamble Electrical (14-day terms) due 2 November 2026, Riverside Bakery (30 days) 18 November 2026; new quote dated 19 October 2026, valid to 18 November 2026; 14 pages using the date code load with no errors. Not tested live: converting a quote to an invoice (would create records).
- Roadmap Wave 0: added ticked task "Health-check leftovers: UK dates, customer payment terms, staff sync key check, package updates".
- Tip: Netlify doesn't report the live deploy back to GitHub. To see when the live site changed, read the `dpl=` value in the page source: after the first 64 characters it's the Netlify deploy id in hex, whose first 8 hex digits are the deploy time.
- Next: Wave 5, Magazines (start by agreeing the Mag Manager feature list with the magazine team).

## 19 October 2026 - FootprintAI section (branch `feature/footprint-ai`, PR waiting for the owner)
- Owner's request: a new invite-only section for the **Footprint AI** programme (brief: "Footprint AI Roadmap", Mitch, 14 October 2026; launch target 19 January 2027, scorecard decisions 18 December 2026). Owner's choices: **admins + invited people** see it; **manual updates + Claude Code now, a proper Claude connector later**; first version = **projects and agents**, plus (owner added mid-build) **progress and a live scorecard per agent**.
- Migration `20261031120000_footprint_ai.sql`: `ai_members` (invite list, admins add/remove), `is_ai_member()` (admin or active invited person), `ai_projects` (type, owner, wave, stage planned/shadow/assisted/supervised/live/on_hold, decision scale/fix/stop, pilot job, tools, human check, next step, dates), `ai_project_updates`, `ai_test_runs` (minutes by hand vs with agent, usable, errors, serious error, cost), `ai_scores` (the brief's 7 rows, not started/on track/pass/fail + evidence; created automatically for each project). All data rules use `is_ai_member()`, not roles. Seeded with the brief's 6 agents (wave 1: account management, web dev and tickets, marketing from 2 November 2026; wave 2: sales, design, AI systems builder from 23 November 2026) and the SSL renewal system (live).
- App: menu entry "FootprintAI" (`/ai`, key `ai`), shown only to admins and invited people (`getCurrentUser` adds ai:view/edit from `is_ai_member`; not in preview-as-role). Left out of Admin → Roles and the feedback page list, so the name isn't shown to others. Pages: `/ai` (countdowns, totals, a card per project with progress bar, scorecard dots, live figures), `/ai/[id]` (progress + "Move to …", live figures, scorecard form, test log, updates, details, admin delete), `/ai/new`, `/ai/members` (admin invite list).
- Checks: build, type check, lint clean; database rules tested on PGlite (26 checks: invited/not invited/deactivated/signed out, admin-only list and delete, can't log as someone else, removing someone takes access away, audit log).
- **LIVE 19 October 2026:** merged by Claude at the owner's request (PR [TobyJacobs/Footprint-CRM#39](https://github.com/TobyJacobs/Footprint-CRM/pull/39), `c64fb5e`); Supabase update succeeded; live from 14:56 BST.
- Click-through (admin, with a labelled test project, since deleted): front page countdowns (60 days to decisions, 92 to launch) and the 7 projects; Move to Shadow; test log with live figures (1h saved, 67% less, 100% usable, £0.42); updates; invite list; signed-out visitors sent to login. **Found:** saving the scorecard failed (upsert needs an insert permission), and error messages for forms lower down a page (FootprintAI, Design approval box, customer timeline) were lost because `?error=` came after `#section`. Fixed in PR [TobyJacobs/Footprint-CRM#40](https://github.com/TobyJacobs/Footprint-CRM/pull/40) (`9d681a7`, live 15:03 BST); scorecard save then checked live.
- **All five people who have signed in are admins** (Toby, Darren, Huw, Lainey, Jack), so all five can see FootprintAI. Told the owner; no access changed.
- Roadmap: new stage **"AI" FootprintAI** at position 8 (Magazines onwards moved down one). Ticked: invite-only section; agents with progress, test log and live figures; live scorecard. Open: "Claude connector: the company's Claude reads and updates FootprintAI".
- **Claude connector ON HOLD until later in the project** (owner, 19 October 2026). A session had started researching Claude connector sign-in; stopped before any plan or code. Roadmap task marked on hold. Don't start it again unless the owner asks.
- Database after clean-up: 7 projects, 49 scorecard rows (all not started), no test runs or updates.
- Later (owner agreed): a Claude connector so the company's Claude can read and update FootprintAI with its own key. Brief items not built yet: phase plan, open questions, documents.

## 20 October 2026 - Owner's improvement list, item 1: customer graphs (branch `feature/customer-glance`, PR waiting for the owner)
- The owner has a list of improvements from recent work, to be done one at a time. Item 1: graphs/figures on each customer.
- Owner's choices: total spend tiles, owed and overdue, quotes and services; at the top of the customer page (not on the list).
- Built "Customer at a glance" (`src/lib/customers/glance.ts`, `customers/[id]/CustomerGlance.tsx`), shown to people who can see sales: lifetime / this year / last year spend (invoices issued or paid minus issued credit notes, before VAT, same rule as Dashboards); owed now and overdue (unpaid invoices less credit notes against them, incl. VAT, linking to the invoice list searched by customer); average days to pay (from `paid_at`); quote win rate and won value; spend by service (`business_unit`) bar chart.
- Checks: 11 calculation tests, build, type check, lint; viewed locally with test data (Chalk Hill Electrical). Test invoices have no service set, so the chart shows "Not set".
- Added `.claude/launch.json` (local dev server "footprintos-dev" on port 3000) for local previews.
- **LIVE 20 October 2026:** merged by Claude at the owner's request (PR [TobyJacobs/Footprint-CRM#41](https://github.com/TobyJacobs/Footprint-CRM/pull/41), `0c29d8d`), live from 11:59 BST. Checked live on Chalk Hill Electrical: same figures as locally (£5,001 spend, £4,590 owed after a £643.20 credit note, 16 days to pay, 60% win rate). The "Owed now" link opens `/sales/invoices?status=issued&q=<name>`.
- Known limit: that link searches by customer **name**, so customers sharing a name (duplicates) show each other's invoices there. The panel's figures always use the exact customer. Possible follow-up: a real customer filter on the invoice list.

## 20 October 2026 - Improvement list item 2: contact address from the customer (branch `feature/contact-address-from-customer`, PR waiting for the owner)
- Owner's request: the contact form's address offers the customer's (company) address in a dropdown, and defaults to it when the customer has one.
- Built `customers/[id]/contacts/ContactAddressFields.tsx`: an "Address" dropdown with "Company billing address: …", "Company delivery address: …" (only if set and different), "A different address", "No address". A contact with no address of its own (new or existing) starts on the company's billing address; picking a company address fills the boxes (still editable); typing over it switches to "A different address"; "No address" clears it. The address is **copied** onto the contact when saved (no database change), so if the company moves later, its contacts keep the old address until changed.
- Checked locally (no saving): new contact for Chalk Hill Electrical defaults to "48 Example Street, Locks Heath…"; switching options and typing behave as above; an existing contact with no address defaults to the company address. Build, type check, lint clean.
- Removed from OPEN-QUESTIONS (details now given).
- **LIVE 20 October 2026:** merged by Claude at the owner's request (PR [TobyJacobs/Footprint-CRM#42](https://github.com/TobyJacobs/Footprint-CRM/pull/42), `f05d00b`), live from 12:09 BST. Checked live (no saving): new contact and an existing contact with no address both default to Chalk Hill Electrical's billing address. Saving not tried live (would change test data); the form sends the same fields as before.

## 20 October 2026 - Improvement list item 3: action buttons on each customer (branch `feature/customer-actions`, PR waiting for the owner)
- Owner's choices: all four groups, as a button bar under the customer's name.
- `customers/[id]/CustomerActions.tsx`: **Sell** (New quote / New sales order / New invoice, with quotes edit; "Sell ads" greyed out "Coming with Magazines" until Wave 5 ad bookings), **Work** (New project with projects edit, New design job with design view, New content item with marketing edit), **Contact** (Email customer → #email, Log a call → `?log=call#timeline` with Call pre-selected, Add contact; customers edit). Each opens with the customer filled in. Hidden for erased (GDPR) customers.
- When Wave 5 adds advert bookings, point "Sell ads" at the new booking page (it's a placeholder in CustomerActions).
- Checked locally: every button opens its page with Chalk Hill Electrical filled in (200s); Log a call selects Call and scrolls to the timeline (fixed: dropdown is keyed so it updates when moving within the page); Email customer scrolls to the email box; phone width wraps neatly. Build, type check, lint clean.
- **LIVE 20 October 2026:** merged by Claude at the owner's request (PR [TobyJacobs/Footprint-CRM#43](https://github.com/TobyJacobs/Footprint-CRM/pull/43), `226dffb`), live from 12:16 BST. Checked live: all buttons show; each page opens (200) with the customer filled in; Log a call picks Call and scrolls to the timeline.
- Speed note: the customer page takes 1.2–2.1s live (customers list ~1.0s). It runs several database reads one after another (projects, sales documents, glance figures…). Possible follow-up: run them all at once (Promise.all).

## 20 October 2026 - Improvement list item 4: design jobs start from projects (branch `feature/design-jobs-from-projects`, PR waiting for the owner)
- **Owner's rule (20 October 2026, replaces "jobs come from sales orders, projects and ad-hoc requests" of 19 October 2026): every new design job is started from a project.** Owner chose "Projects only" over "just not from customers".
- Changes: customer action bar no longer has "New design job"; the "Design jobs" card on customer pages lists jobs only, with "Design jobs are started from one of this customer's projects."; on a sales order the card's "Create design job" goes through the order's project (or says to create a project first); `/design/new` without a project shows a project picker (open projects); with a project, the customer is shown read-only ("From the project."); `saveJob` refuses a new job without a project and takes customer and sales order from the project. Editing an existing job is unchanged. No database change.
- Checked locally: customer page (no create link, note shown), project and sales order pages (create link → project), picker, and a labelled test job saved from FO-1498 with customer Hamble Electrical, SO-010928 and FO-1498 linked, then deleted. Build, type check, lint clean.
- **LIVE 20 October 2026:** merged by Claude at the owner's request (PR [TobyJacobs/Footprint-CRM#44](https://github.com/TobyJacobs/Footprint-CRM/pull/44), `bc4d8b6`), live from 12:30 BST. Checked live (no saving): customer page note and no create link; project and sales order link to the project; picker without a project; customer read-only from a project.

## 20 October 2026 - Improvement list item 5: Projects under customer Details (branch `feature/customer-projects-under-details`, PR waiting for the owner)
- Owner: show Projects (with its action button) below the customer's Details, not in the side column. Moved the Projects card to straight after Details in the main column; "New project" is now a "+ New project" button. Order now: Customer at a glance, Details, Projects, Contacts, Quotes…, Hosting, Retainers; side column: Design jobs, Accounts & credit, Sales & marketing, Email, Timeline.
- Checked locally on Hamble Electrical; build and lint clean. No database change.
- **LIVE 20 October 2026:** merged by Claude at the owner's request (PR [TobyJacobs/Footprint-CRM#45](https://github.com/TobyJacobs/Footprint-CRM/pull/45), `27b36d0`), live from 14:02 BST; checked live: Details then Projects, New project button opens a project for the customer.

## 20 October 2026 - Improvement list item 6: quote lines with cost first, margin % and GP (branch `feature/quote-lines-margin`, PR waiting for the owner)
- Owner: swap cost and price; line columns Qty, Cost, Sell, Discount, VAT, Total, Margin % (type a margin → sell price, and the other way), GP £ per line + total.
- `src/lib/sales/options.ts`: `lineCost`, `lineGp`, `lineMargin`, `priceForMargin(unitCost, margin%, discount%)` = cost / ((1 − margin) × (1 − discount)), null without a cost or at ≥100%. Totals use `lineCost` (same rule as before, incl. GP overrides).
- Editor (`sales/DocumentEditor.tsx`, used for quotes, orders, invoices, credit notes): Item, Qty, Cost £, Sell £, Disc %, VAT, Total £ (before VAT), Margin % (editable; read-only on lines with a GP override), GP £ (red if negative); totals box adds GP. The margin typed is screen-only (`margin_input`), never saved.
- View page (`sales/[id]`): Qty, Cost (per unit; derived from the override when there is one), Sell, Disc, VAT, Total, Margin, GP; Margin box adds total GP. Customer print/online copies unchanged (no cost or margin).
- Checks: 9 maths tests (discount, override, negative margin, totals), build, type check, lint; locally on QT-010185 (cost £20): 50% → £40.00, 35.5% → £31.01, not saved.
- **LIVE 20 October 2026:** merged by Claude at the owner's request (PR [TobyJacobs/Footprint-CRM#46](https://github.com/TobyJacobs/Footprint-CRM/pull/46), `6cd09ce`), live from 15:59 BST. Checked live on QT-010185: new columns on view and editor; typing 50% gave £40.00 / GP £20.00; left without saving. (A local build once failed with a one-off "Error while requesting resource" download error; re-runs passed.)

## 20 October 2026 - Improvement list item 7a: quote business units (branch `feature/quote-business-units`, PR waiting for the owner)
- Owner: quotes choose a business unit from **Print/Merch, Advertising, Footprint AI, Signage**. Owner chose **quotes only** (orders, invoices, recurring invoices and products keep Zoho's Print / Account Sales / Digital) and **convert existing quote "Print" to "Print/Merch"**.
- `quoteBusinessUnits` in `src/lib/sales/options.ts`; DocumentForm uses it for quotes. Migration `20261101120000_quote_business_units.sql` converts quote "Print" → "Print/Merch" (0 test quotes had a business unit, so nothing changes today). **Go-live import: map quote "Print" to "Print/Merch" too.**
- A quote's business unit is copied to its order/invoice, where the new names show as "(from Zoho)" in the older list; owner aware.
- Item 7b (choose Quote / Advertising / Proposal when creating a new opportunity, each its own page, based on Zoho CRM Deals) is next: looking in Zoho first (read only).

## 20–21 October 2026 - Improvement list item 7b: opportunity types (branch `feature/opportunity-types`, built on #47, PR waiting for the owner)
- Owner: when creating a new opportunity, choose **Quote, Advertising or Proposal**, each its own page. Owner said skip the Zoho login and **guess**, then preview (Zoho CRM Deals not checked, so details are a first guess).
- Migration `20261102120000_quote_kinds.sql`: `sales_documents.quote_kind` ('quote' | 'advertising' | 'proposal', default 'quote'); carried over on conversion.
- `/sales/opportunity` chooser (three cards; customer kept). "New quote" buttons (customer action bar, customer page quotes card, quotes list) now say "New opportunity" and open it. `/sales/new?type=quote&kind=…` shows "New quote / New advertising quote / New proposal".
- **Advertising:** business unit Advertising, title "Advertising in Forget Me Not", an advert builder (`sales/AdvertBuilder.tsx`): ad size, first month, number of months, price per edition, optional cost, editions (Fareham, Hedge End + "other editions" text) → one line per month, quantity = editions. Sizes and editions are guesses in `adSizes` / `knownEditions` (src/lib/sales/options.ts): **need the 11 edition names and real sizes/prices from the magazine team.**
- **Proposal:** title "Proposal", notes start with a template (Overview, What we'll deliver, Timeline, Next steps) labelled "The proposal (the customer sees this)".
- Type shown as a pink badge in the quotes list and as "Type" in the quote's Details.
- Not done: the customer's printed/online copy still says "Quote" for proposals and advertising quotes (possible follow-up).
- Checked locally (not saved): chooser; advertising builder made 3 lines (Nov 2026–Jan 2027, 2 editions × £45 = £270, GP £210); proposal template. Build, type check, lint clean.
- **The quote_kind column must be in the database before the quotes list works** with this code (it's added automatically when merged).
- **LIVE 21 October 2026:** owner said "deploy both". Merged #47 (`ccc473d`) and #48 (`a13b3bb`, after resolving a merge clash in DocumentForm, options and PROGRESS by keeping the #48 side); both Supabase updates succeeded; live from 10:21 BST. Checked live: `quote_kind` column present (219 quotes = 'quote'); quotes list loads with "New opportunity"; chooser, advertising (builder) and proposal pages load with the new business units; sales orders keep the old list; customer page buttons go to the chooser. Saving an opportunity not tried live (would create a record).
- Preview links were given for #47 and #48 before merging (previews share the test database).

## 21 October 2026 - Improvement list item 8: labour cost in the quote (branch `feature/labour-cost-in-quote`, PR waiting for the owner)
- Owner: put labour costs in the quote instead of in Details. The "Labour cost £" box moved from the Details card into the lines box (DocumentEditor, under "Add line"; not on credit notes), with "Staff time for the whole job. Never shown to the customer."
- Totals now add **Labour** and **GP after labour** (GP − labour) when a labour cost is entered; the quote page's Margin box adds "GP after labour" too. The existing GP / margin / cost figures and the Dashboards are unchanged (labour still isn't part of `cost_total`).
- Same field name (`labour_cost`), so saving and copying to orders are unchanged. Checked locally on QT-010185 (not saved): £12.50 labour → GP after labour £15.14. Build, type check, lint clean.
- **LIVE 21 October 2026:** merged by Claude at the owner's request (PR [TobyJacobs/Footprint-CRM#49](https://github.com/TobyJacobs/Footprint-CRM/pull/49), `06dc3ba`), live from 10:26 BST; checked live on QT-010185 (not saved): box in the Quote card, gone from Details, GP after labour £15.14.

## 21 October 2026 - Improvement list item 9: emails not in junk, new sender (branch `fix/email-delivery`, PR waiting for the owner)
- Owner: quotes shouldn't go to customers' junk, and shouldn't come from toby@footprintgroup.uk. Owner's choices: **from "Footprint Group <hello@footprintgroup.uk>" for everything**; **replies go to the salesperson who sent it**.
- DNS check (21 October 2026, read only): SendGrid domain authentication present (DKIM CNAMEs s1/s2._domainkey → u114118795.wl046.sendgrid.net); DMARC `v=DMARC1;p=none;` (monitor only); SPF lists Zoho, Outlook and Campaign Monitor (SendGrid passes via DKIM); no Microsoft 365 DKIM (selector1) records.
- Code: `sendEmail` switches off SendGrid click, open and subscription tracking (tracked links on sendgrid.net are a junk signal) and takes a `replyTo`; quotes/orders/invoices/credit notes, POs, design proofs and customer emails reply to the signed-in sender; staff invites keep `EMAIL_REPLY_TO`. Tested with a fake SendGrid (5 checks).
- **Owner step:** in Netlify → Site configuration → Environment variables, set `EMAIL_FROM` to `Footprint Group <hello@footprintgroup.uk>` (all contexts), then redeploy. Any @footprintgroup.uk address works because the domain is authenticated in SendGrid. Optional: a hello@ mailbox/alias in Microsoft 365; later tighten DMARC to p=quarantine and turn on Microsoft 365 DKIM.
- **LIVE 21 October 2026:** merged by Claude at the owner's request (PR [TobyJacobs/Footprint-CRM#50](https://github.com/TobyJacobs/Footprint-CRM/pull/50), `fe556d1`), live from 10:47 BST; quote, customer and design pages load; live site is not in email test mode. At the owner's request, Claude changed **`EMAIL_FROM` in Netlify to `Footprint Group <hello@footprintgroup.uk>`** (same value for all deploy contexts; checked Production) and triggered a redeploy (published 11:05 BST, 21 October 2026).
- **Confirmed by the owner (21 October 2026):** a test quote (QT-010185, sent 11:13 BST to the owner's iCloud) shows **From: hello@footprintgroup.uk, Reply-To: toby@footprintgroup.uk** (the sender). Working as intended. An earlier test at 11:10 still came from toby@: probably a page opened before the redeploy (skew protection keeps open pages on the old version). Test quotes QT-010185 and QT-010191 are now marked Sent.
- Lesson: after changing a Netlify environment variable, redeploy, and reload any open FootprintOS pages before testing.

## 21 October 2026 - Junk mail at the director's; plan for FootprintOS's own web address (Go-live)
- Owner's iCloud: quote landed in the inbox. Director (dealclub.uk, another company's Microsoft 365) got it in junk. Checked (read only): emails are DKIM-signed for footprintgroup.uk; SPF is valid but at **9 of 10 lookups** (don't add more includes); DMARC p=none. Most likely junk signal: the "View your quote" link points to **footprintgroupos.netlify.app** (free-hosting links weigh heavily at Microsoft); also hello@ is a brand-new sender on SendGrid's shared IPs. Suggested: director marks "Not junk"; headers (Outlook "View message details") would show Microsoft's exact verdict.
- **Plan, owner's request, added to the Go-live roadmap stage as an open task:** "Own web address for FootprintOS (os.footprintgroup.uk) so email links use our domain".
  1. Address: **os.footprintgroup.uk** recommended (app. → whitelabel.ludicrous.cloud and hub. → fpghub.netlify.app are taken; os/portal/crm free).
  2. Netlify: add as the primary domain of site footprintgroupos (free HTTPS; the netlify.app address forwards).
  3. DNS is at **20i (StackCP, ns1-4.stackdns.com)**: CNAME `os` → `footprintgroupos.netlify.app`.
  4. Supabase Auth (test now, London at Go-live): add `https://os.footprintgroup.uk/**` to redirect URLs, then make it the Site URL. Microsoft Entra needs no change (sign-in goes through Supabase).
  5. Code: build email links (quotes, invoices, proofs) from the main address (`process.env.URL`) instead of the browser's host. `netlify/functions/directory-sync.mts` already uses `process.env.URL`.
  6. Staff sign in once on the new address; send a test quote. Free, ~30–45 min with the owner signed in to 20i; reversible.

## 21 October 2026 - Improvement list item 10: customer's quotes and sales orders shown separately (branch `feature/customer-docs-split`, PR waiting for the owner)
- The customer page's single "Quotes, orders & invoices" box is now three: **Quotes**, **Sales orders**, **Invoices & credit notes** (`customers/[id]/CustomerDocsCard.tsx`). Each shows the latest 10 with the total in the title, its own button (New opportunity / New sales order / New invoice) and "See all N" (list searched by customer name) when there are more. Quote type badge and "(credit note)" label shown.
- Checked locally: Chalk Hill Electrical (Quotes 6, Sales orders none, Invoices & credit notes 5), Hamble Electrical (QT-010039, SO-010928). Build, type check, lint clean. No database change.
- **LIVE 21 October 2026:** merged by Claude at the owner's request (PR [TobyJacobs/Footprint-CRM#51](https://github.com/TobyJacobs/Footprint-CRM/pull/51), `ec3fefc`), live from 11:26 BST; checked live on Chalk Hill and Hamble Electrical (three boxes, old combined box gone).

## 21 October 2026 - Improvement list item 11: no product number on quotes (branch `fix/no-product-number-on-quotes`, PR waiting for the owner)
- Owner: don't show the product number in quotes. `productLineText` now gives just the product name (+ description) for quotes, orders and invoices; purchase orders pass `withNumber` and keep "number – name". `product_code` is still saved on every line by the database trigger, for Xero. Existing (test) lines unchanged. Recorded in DECISIONS (updates 5 October 2026).
- Checked locally (not saved): quote line from A-Frame Signs reads "A-Frame Signs" (was "AFFP102 – A-Frame Signs"); PO line keeps "number – name". Build, type check, lint clean. No database change.
- **LIVE 21 October 2026:** merged by Claude at the owner's request (PR [TobyJacobs/Footprint-CRM#52](https://github.com/TobyJacobs/Footprint-CRM/pull/52), `6228f47`), live from 11:36 BST; checked live (not saved): quote line reads "A-Frame Signs".
