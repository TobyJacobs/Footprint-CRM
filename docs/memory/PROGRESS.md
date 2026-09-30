# Progress — where we are right now

_Last updated: 30 September 2026_

## Current stage
**Wave 0 — Foundations, part 1 of 2.** Working on branch `wave-0/foundations`.

## Done
- Planning (Session 1):
  - brief (`docs/PROJECT-BRIEF.md`)
  - roadmap (`docs/ROADMAP.md`, owner-confirmed order)
  - decisions (`DECISIONS.md`)
  - brand guide (`docs/BRAND.md`)
- Planning work merged into `main` and pushed (30 September 2026).
- Setup: GitHub auto-push ✅, Supabase "Footprint Group - CRM" organisation ✅, Netlify connected ✅, Microsoft 365 admin ✅.
- Node.js 24 installed on the owner's computer.
- **Wave 0 part 1: app shell**
  - Next.js 16 app (TypeScript, Tailwind) in the repo root.
  - Footprint branding: Montserrat, black sidebar, gradient accent, pink highlights.
  - One navigation section per feature, driven by `src/lib/features.ts`. Each section shows a "Coming in Wave X" placeholder.
  - Works on desktop and mobile (hamburger menu).
  - Lint, type check and build all pass. Checked in the browser.
  - `netlify.toml` sets Node 24.

## Next (Wave 0 part 2)
1. Get a Netlify preview link for the branch (open a pull request) and have the owner check it.
2. Supabase test project (Frankfurt): rename to "Footprint Platform – Test" and connect the app.
3. "Sign in with Microsoft": Microsoft 365 app registration (guided) + Supabase Azure provider. Protect every page.
4. Users, teams, roles and permissions tables + admin screens; row-level security.
5. Audit log, backups test, error monitoring.

## Waiting on the owner
- Logo files (see `docs/BRAND.md`). A text wordmark is used until then; the favicon is still the Next.js default.

## How backups work on this computer
Git Credential Manager holds the owner's GitHub sign-in, so **Claude pushes automatically after every commit**.

## Local running
The dev server runs from the Claude desktop preview (`.claude/launch.json` in `Documents\claude`) at http://localhost:3000.
