# Session log

One short entry per session. Newest at the top.

---

## 21 October 2026: Improvement list items 10-13
- Customer quotes/orders/invoices split (#51), no product number on quotes (#52), margin as £ and % everywhere (#53): all merged by Claude at the owner's request and checked live.
- Urgent fix #54: the margin box blocked saving quotes with a no-cost line. Merged and checked live.
- "Send quote" + PDFs (#55): live after Claude retried a failed Netlify build (GitHub fetch glitch) with the owner's permission; checked live.
- Customer links as Copy buttons only, no address shown (#56): merged and checked live.

## 19 October 2026: Friendly message after a new release
- Staff with a page open during a release got "Something went wrong" on their next click (an old page calling a button the new release no longer knows). Seen on /login after #36.
- Fix on branch `fix/friendly-update-message`: switched on Netlify's skew protection in `netlify.toml` (old open pages keep talking to the old release, so most clicks just work), and the error page now says "FootprintOS has just been updated" with a Refresh button for any that slip through (not sent to Sentry). Build, types and lint clean. Pull request #37 merged by the owner on 19 October 2026 (`be428c9`). Owner then added a Supabase secret key to `.env.local`; Claude used it to add the ticked task to Roadmap Wave 4.
- To check after merging: open a page, wait for the next release, then click a button. It should work, or show the new message.

## 19 October 2026: Wave 4 Part 4b, online proof approval
- Part 4a (#35) had been merged by the owner.
- Built Part 4b: the design team emails a proof (or makes a link), and the customer approves it or asks for changes on a private page. The answer moves the job and is noted on the job and the customer.
- Tested the database rules on a temporary PGlite database (all 21 checks passed). Build, types and lint clean. Pull request #36 opened and, at the owner's request, merged by Claude (`d740a7f`).
- Click-through found the Design tables missing live: Supabase's automatic update had failed since 15 October 2026 because seven hand-applied migrations weren't recorded. Recorded them (owner approved), the update then applied 4a and 4b. Full click-through passed (email, request changes, link only, approve). Roadmap Wave 4 ticked. The owner checked the test email; test job DJ-1001 then deleted.
- Later: moved the backup-restore test to Go-live only, and did the health-check leftovers in one PR (UK dates, customer payment terms, sync key check, package updates, Design page access checks). Merged and checked live.
- Built the invite-only FootprintAI section from Mitch's Footprint AI brief: agents and systems with progress, live scorecard, test log and updates; admin-managed invite list. Merged (#39), clicked through live, fixed the scorecard save and lost error messages (#40), added a FootprintAI stage to the roadmap, deleted the test project.

## 16–19 October 2026: New laptop, merges and invoice safety (cloud session)
- The owner merged #32 and #33 and tested the quote flow live: works well.
- Owner moved to a new laptop; checked GitHub has everything and explained what must be set up again (`.env.local`, Claude settings, Chrome extension). Flagged that the GitHub repository is public.
- Built invoice safety (fixed status rules, no double conversion, failed email leaves a draft) and the UK summer-time fix for follow-up times, in one pull request.
- The owner merged it (#34). Owner chose to leave the 100% margin display as it is.
- Started Wave 4 (Design Workload). Owner's answers recorded in PROGRESS. Built Part 4a (job board, list, my jobs, files with proof versions, notes, links from orders/projects/customers) and tested the database rules on a temporary local database.

## 15 October 2026: Repository health check (cloud session)
- Checked build, type-check, lint and package security on `main`: all clean, no known vulnerabilities.
- Reviewed the code for obvious bugs and the memory files for out-of-date notes.
- Fixed small, safe problems only, in one pull request (branch `claude/charming-lovelace-5i9y13`): emails to two or more addresses failed; the after-login redirect could be steered to another website; four places ignored database errors (GDPR export logging, template steps on new projects, deleting a target, marking a request as a query); memory files brought up to date. Bigger issues are listed in that pull request for the owner to choose from. Nothing merged, deployed or changed in any database.
- Note: sessions between 2 and 13 October 2026 have no entry here; their work is recorded, dated, in `PROGRESS.md`.

## 15 October 2026: Marketing, Dashboards, speed and health-check fixes
- Built the Marketing team workspace (overview, content calendar, ad campaigns, templates) on `feature/marketing-workspace`, PR #24. Database part applied to the test database. The safety check blocked Claude from merging; the owner merged it, so it's live. Roadmap ticked.
- Marketing home page for the Marketing team role (like Directors, Sales, Finance, Operations), PR #25, merged by the owner. Roadmap ticked. The safety check still blocks Claude's final merge click in every mode, so the owner presses merge.
- At the owner's request, moved every import and switch-off task (Zoho Projects, Zoho One, monday.com, Mag Manager, Vault, Cliq, the Zoho billing trial) into Go-live.
- Built the Wave 3 Dashboards section (Revenue, Pipeline, Renewals, Time), PR #26, merged by the owner. Roadmap ticked.
- Profit after time with hourly costs per role (made-up example rates; Zoho check postponed by the owner), PR #27, live. Wave 3 building work complete.
- Smoother feel (hover lift, button press, page fade-in, reduced-motion respected), PR #28, live and checked in the live stylesheet.
- Owner said clicks feel slow. Found: no loading states, Netlify functions in Ohio while the database is in Frankfurt (region change needs a paid Netlify plan — owner to decide), and an extra login check per page. Built loading screens, a top progress bar and busy buttons (PR #29, live).
- Click-through test signed in as the owner: every page loads, figures agree. Health-check fixes: database tune-up (#30), polish batch with readable Audit log, view-only marketing items, phone calendar list view, preview as role (#31), and a one-pass Staff hub fix (#32). Junk test requests removed.

## 14 October 2026: Roadmap check
- The Claude app is now on a different Claude account. Checked that the project itself (code, GitHub, commit identity) is unchanged.
- Read the roadmap on both Supabase projects (read only). Found that the live London database exists, and that the live roadmap was out of date.
- The owner confirmed SendGrid works (a real invite reached a colleague).
- Auto mode blocked writing to Live. The owner switched to Ask permissions, and Claude then tidied the live roadmap: 7 tasks ticked, Postmark renamed to SendGrid, Wave 3 off hold. Verified.
- Found that the live website still uses the test database, and that the daily Microsoft 365 sync has run every day since 7 October. Tidied the roadmap on the test database too (the one the app shows) and ticked off the daily sync.
- Set up "fewer prompts" (local permission settings). At the owner's request, moved the Zoho customer import into the Go-live stage and added "Move the website to the London database" there.
- Job titles for automatic roles: matching was already built; only 3 of 43 staff have titles. Added a Marketing team role (owner approved its access). Owner to fill in titles in Microsoft 365.

## 1 October 2026 — Session 3 (continued): Wave 2a
- Read Zoho Books settings (numbering, VAT, custom fields; no records) and wrote `docs/discovery/ZOHO-BOOKS.md`.
- The owner chose: core flow first (2a/2b/2c), secure-link approval, and keep-and-tidy custom fields.
- Built the products, quotes, orders, invoices, approval link, print layout and company settings, and tested the full flow end to end.
- Found that Netlify "Team protection" also covered the live site. With the owner's approval it's now previews only. Merged PR #4, so Wave 2a is live for the demo.

## 1 October 2026 — Session 3: Wave 1 begins
- Read Zoho CRM's module and field definitions through the owner's signed-in Chrome (no customer records) and wrote `docs/discovery/ZOHO-CRM.md`.
- Found plain-text third-party passwords in Zoho Web Hosting Plans. Decision: these move to the password manager and are never migrated.
- The owner chose core + Footprint fields, with hosting plans and retainers in Wave 1 and Zoho Billing in Wave 2.
- Built the Customers section, its database tables and the made-up test data, and tested it end to end in the browser. Fixed a line-saving bug.
- Microsoft sign-in now also brings people's names through.
- Built and tested the GDPR tools: admin-only export and erasure, with audit-log redaction.
- The owner put the live database and real data **on hold until the final wave**, pending a director demo. The roadmap now has a final "Go-live cut-over" stage.
- The owner checked the preview. Claude merged PR #3, so Wave 1 is live on footprinthub.netlify.app with made-up data. Supabase correctly skipped the already-applied migrations.

## 30 September 2026 — Session 2: Wave 0 begins
- Merged the planning work into `main`. Created branch `wave-0/foundations`.
- Confirmed the Supabase organisation. Its auto-created project (Frankfurt) becomes the test database; live will be in London (see DECISIONS).
- Installed Node.js 24. The automatic install got stuck on a hidden Windows permission prompt, so the owner installed it manually.
- Built the app shell: Next.js 16, Footprint branding, one navigation section per feature with placeholders, and a mobile menu. Build and lint pass, and it was checked in the browser.
- Built Wave 0 part 2:
  - the database migration: roles, permissions, audit log, row-level security
  - Sign in with Microsoft
  - admin screens
- 1 October 2026 setup, done by Claude in the owner's Chrome with approval:
  - renamed the Supabase project
  - applied the migration
  - turned on GitHub auto-deploy (at the owner's request)
  - set the redirect URLs
  - registered the Entra app with email claims
  - filled in the Azure provider (the owner pasted the secret)
  - saved `.env.local`
- Checked that the local sign-in button reaches Footprint's Microsoft login.
- The owner signed in and became admin. Added the Netlify environment variables.
- Fixed the 404 on the Netlify preview by adding `@netlify/plugin-nextjs`.
- The owner tested the preview. Claude merged PR #1 into `main`, and it's live at footprinthub.netlify.app.
- Wave 0 finishing (PR #2):
  - logo and icon (from the website, with permission)
  - security headers
  - Sentry (the owner made the account; Claude created the project; the owner pasted the DSN into Netlify)
  - Admin → System test-error button
  - backup runbook
- The owner tested it and Claude merged it. **Wave 0 complete.**

## 29 September 2026 — Session 1: Kickoff
- Created the memory files in `docs/memory/`.
- Read footprintgroup.uk and forgetmenotonline.org for context.
- Interviewed the owner in 4 batches and recorded the answers in `INTERVIEW-NOTES.md`.
- Wrote `docs/PROJECT-BRIEF.md`. The owner reviewed it and added digital quote approval, Microsoft 365 login, one navigation section per feature, and distributors as a later stage.
- Key decisions:
  - Your Lead Kit stays on GoHighLevel.
  - Xero stays.
  - Teams replaces Cliq.
  - A proven password manager replaces Zoho Vault.
  - Tech stack is Next.js + Supabase + Netlify.
- Wrote `docs/ROADMAP.md` (Waves 0–8). Proposed Design Workload as Wave 1 — awaiting the owner's confirmation.
- The owner asked for Zoho first → roadmap reordered (Customers, then Quote to Invoice, then Projects; Design Workload moved to Wave 4).
- The owner created the "Footprint Group" Supabase organisation (authorised with GitHub), connected Netlify to GitHub, and confirmed they have a Microsoft 365 admin account.
- Wrote `docs/BRAND.md` from the Footprint website: Montserrat, black/white, pink `#de2277`, orange `#e58207`, teal `#7bcbd1`, gradient. Logo files to follow.
- The owner signed in to GitHub through Git Credential Manager, so Claude now pushes automatically after each commit.
