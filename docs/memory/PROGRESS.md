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
