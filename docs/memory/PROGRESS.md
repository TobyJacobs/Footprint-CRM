# Progress — where we are right now

_Last updated: 1 October 2026_

## Current stage
**Wave 0 — Foundations: COMPLETE (1 October 2026)**, live on footprinthub.netlify.app (test database). The only deferred item is the backup restore test, which happens when the live London database is created. **Next: Wave 1 (Customers).**

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

## Next
1. **Wave 1: Customers**, on a new branch. Start by agreeing the customer fields and the import approach for the ~15,000 Zoho records.
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
