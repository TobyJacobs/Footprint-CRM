# Footprint Platform — Standing Instructions for Claude

Claude reads this file automatically at the start of every session. Keep it short and up to date.

## Who you are working with
- The project owner is **not a developer**. Always explain things in plain, simple English.
- Avoid jargon. If a technical word is unavoidable, explain it in one short sentence.
- Before doing anything big, say what you are about to do and why, in 2–3 sentences.
- When you need a decision, give a clear recommendation plus at most 2 alternatives, with pros and cons in everyday language.
- At the end of each piece of work, give a short summary: what changed, what to check, what comes next.

## What we are building
A secure, multi-user business platform for **Footprint Group** (https://footprintgroup.uk) that replaces:
- **Zoho One** — Books (accounts/invoicing), CRM, Projects, Vault (passwords), Cliq (team chat)
- **Mag Manager** — magazine publishing (ad sales, issues, flatplans, bookings)
- **GoHighLevel** — marketing (campaigns, email/SMS, funnels, pipelines)
- **monday.com** — design team workload and scheduling
- **Existing custom HTML sites** — reporting dashboards and intranet

Hosting: **Netlify**, deployed automatically from this GitHub repository.

The full brief lives in `docs/PROJECT-BRIEF.md` and the plan in `docs/ROADMAP.md`.

## Memory — how you remember things between sessions
Your memory lives **inside this repository** so it is backed up to GitHub and never lost.

| File | What goes in it |
|---|---|
| `CLAUDE.md` (this file) | Standing rules. Change rarely. |
| `docs/memory/PROGRESS.md` | Where we are right now: current wave, what's done, what's next. Update at the end of every session. |
| `docs/memory/DECISIONS.md` | Every important decision, dated, with the reason. Never delete entries — add a new one if a decision changes. |
| `docs/memory/GLOSSARY.md` | Footprint's business terms and what they mean (e.g. flatplan, ad booking). |
| `docs/memory/OPEN-QUESTIONS.md` | Things we still need answers to from the owner or the business. |
| `docs/memory/SESSION-LOG.md` | One short dated entry per session: what we did. Newest at the top. |

Rules:
1. **Start of every session:** read `docs/memory/PROGRESS.md` and the latest entries of `SESSION-LOG.md`, then tell the owner in 3–5 lines where we left off.
2. **End of every session** (or when the owner says "save", "wrap up" or "back up"): update the memory files, then commit and push to GitHub with a clear message. This push *is* the backup.
3. If you learn something the business relies on, write it down straight away — don't wait for the end.
4. Dates are always written in full (e.g. 29 September 2026), never "yesterday" or "next week".

## Security rules (non-negotiable)
- **Never** put passwords, API keys, or customer data in the code or in any file in this repository. Secrets go in Netlify environment variables only.
- Every user must log in. Every page and every piece of data must check what that user is allowed to see (role-based access).
- Treat the Vault replacement as highest risk — design it with encryption and get the owner's sign-off before building it.
- Personal data must follow UK GDPR. Flag anything that might not.
- Ask before deleting anything, changing live data, or doing anything that can't be undone.

## How we work
- Work in **waves** (see `docs/ROADMAP.md`). Finish and test one wave before starting the next.
- Small steps. Commit often with plain-English commit messages.
- Test changes on a Netlify preview link before they go live, and give the owner the link to check.
- Prefer well-known, well-supported tools over clever or obscure ones — this platform must be maintainable for years.
