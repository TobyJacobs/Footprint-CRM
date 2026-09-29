# Kickoff prompt — paste this into Claude Code for the very first session

---

Hi Claude. This is the first session of a long-running project. Please read `CLAUDE.md` first — it explains who I am, what we're building, and how you must record your memory.

**Background:** I work with Footprint Group (https://footprintgroup.uk). They currently run the business on Zoho One (Books, CRM, Projects, Vault, Cliq), Mag Manager (magazine publishing), GoHighLevel (marketing), monday.com (design team workload) and some custom HTML sites I built for reporting and the intranet. My job is to replace all of these with one secure, multi-user platform that we build ourselves. This repository is connected to a Netlify project. I am not a developer, so please keep everything in simple English.

**What I need from you in this session:**

1. **Set up your memory.** Create the `docs/memory/` files listed in `CLAUDE.md` (they can start nearly empty). Commit and push them so they're backed up.

2. **Interview me to build the project brief.** Ask me questions in small batches (no more than 5 at a time) so you understand:
   - What Footprint Group does, how many staff, and what roles/teams they have
   - For each tool we're replacing: what we actually use it for day to day, what we love, what annoys us, and what we *don't* use
   - Who needs access to what (roles and permissions)
   - What data we need to bring across from the old systems
   - Must-have integrations (e.g. bank feeds, HMRC/Making Tax Digital, email, payments)
   - Security, backup and GDPR expectations
   - Budget for running costs, and any deadlines (e.g. software renewal dates)
   You may look at the Footprint Group website to get context before you start asking.

3. **Write the brief.** Turn my answers into `docs/PROJECT-BRIEF.md`: a plain-English document covering goals, users and roles, features grouped by area, security requirements, data migration, what's out of scope, and risks. Show me a summary and let me correct it before moving on.

4. **Recommend the technical foundations.** In simple terms, suggest what we should build on (for example: database, login system, how it runs on Netlify) and why. Record the choice in `DECISIONS.md` once I agree.

5. **Create a wave-based roadmap** in `docs/ROADMAP.md`:
   - **Wave 0** should be the foundations: login, users and roles, security, the basic app layout, and automatic deployment.
   - Each later wave should deliver something staff can actually use, and should let us switch off (or reduce) one of the old tools where possible.
   - For each wave give: the goal, what's included, what "done" looks like, which old tool it replaces, rough size (small/medium/large), and what it depends on.
   - Order the waves by business value and risk, and explain your reasoning. Suggest where the Vault (passwords) replacement should go given how sensitive it is — it may be better to use a proven product for that instead of building one; give me your honest view.

6. **Wrap up.** Update `PROGRESS.md` and `SESSION-LOG.md`, commit and push, and tell me in a few lines what we should do in the next session.

Please don't write any application code yet — this session is only about memory, the brief and the roadmap.
