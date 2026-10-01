# Progress — where we are right now

_Last updated: 1 October 2026_

## Current stage
**Wave 0 — Foundations, part 2 of 2: set up, about to be tested.** Working on branch `wave-0/foundations`.

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

## Next
1. The owner checks sign-in on the preview link, then merges PR #1 into `main`. That publishes to footprinthub.netlify.app; Supabase skips the already-applied migration.
2. Remaining Wave 0 items: backups restore test, error monitoring, logo files.
3. Then Wave 1 (Customers).

## Waiting on the owner
- Logo files (see `docs/BRAND.md`). The favicon is still the Next.js default.

## Key IDs (not secret)
- Netlify site: `footprinthub` → https://footprinthub.netlify.app
- Supabase test project ref: `ifspqkcdatruybgzygic`
- Entra app (client) ID: `40bb9fdf-798e-4644-a888-b0e2e788f495`
- Tenant ID: `b2165b1f-511b-4829-a947-40cc1fbbb769`

## How backups work on this computer
Git Credential Manager holds the owner's GitHub sign-in, so **Claude pushes automatically after every commit**.

## Local running
The dev server runs from the Claude desktop preview (`.claude/launch.json` in `Documents\claude`) at http://localhost:3000.
