# Session log

One short entry per session. Newest at the top.

---

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
