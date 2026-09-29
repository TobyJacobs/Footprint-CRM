# Progress — where we are right now

_Last updated: 29 September 2026_

## Current stage
**Planning complete (Session 1).** Brief, technical foundations and roadmap are agreed. Next up: **Wave 0 — Foundations**. No application code yet.

## Done
- Standing instructions (`CLAUDE.md`) and kickoff prompt.
- Memory files in `docs/memory/` (plus `INTERVIEW-NOTES.md` with the raw interview answers).
- `docs/PROJECT-BRIEF.md` — draft 2, reviewed and corrected by the owner.
- Technical foundations agreed: Next.js + Supabase (London) + Netlify, with Microsoft 365 staff login. See `DECISIONS.md`.
- `docs/ROADMAP.md` — draft 2, **owner-confirmed order**:
  - 0 Foundations
  - 1 Customers
  - 2 **Quote to Invoice**
  - 3 Projects, Time and Dashboards (Zoho off)
  - 4 Design Workload
  - 5 Magazines
  - 6 Portal
  - 7 Reporting and Intranet
  - 8 Marketing

## Waiting on the owner
- Agree to a separate "Footprint Group" organisation in the existing Supabase account (see `OPEN-QUESTIONS.md`).
- The "Before we start Wave 0" list in `ROADMAP.md`:
  - Netlify
  - Supabase
  - a Microsoft 365 admin
  - branding files
- Merge the `setup/claude-brief-and-memory` branch into `main` (Claude to walk the owner through it).

## Next
1. Merge the branch into `main`.
2. Start Wave 0: set up the Next.js app, Supabase test and live databases, and Microsoft sign-in.
3. Side track: owner starts moving passwords to 1Password/Bitwarden and chat to Teams.

## How backups work on this computer
Claude commits; the owner clicks **Push origin** in GitHub Desktop (Claude can't push from here).
