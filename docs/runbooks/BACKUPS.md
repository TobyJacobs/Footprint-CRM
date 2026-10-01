# Backups and restore — runbook

_Written 1 October 2026. Review whenever the database setup changes._

## What gets backed up

| What | Where it lives | How it's backed up |
|---|---|---|
| The code, database design and documentation | GitHub (`TobyJacobs/Footprint-CRM`) | Every change is a commit; GitHub keeps full history. Claude pushes after every commit. |
| Settings (Netlify, Supabase, Microsoft) | The services themselves | Written down in `docs/memory/PROGRESS.md` ("Key IDs") and `DECISIONS.md`, so they can be recreated. Secrets are **not** written down — they're recreated, not restored. |
| **Business data** (customers, invoices, users, audit log…) | Supabase database | See below. |
| Files (later: drafts, artwork, PDFs) | Supabase Storage | See below. |

## Database backups

**Test database (Frankfurt, Free plan):** holds only test data. The Free plan has no restorable backups — that's acceptable because nothing real is stored there. The database *design* is safe in GitHub (`supabase/migrations/`), so it can always be rebuilt.

**Live database (London, to be created before Wave 1 real data):**
1. **Pro plan** (~£20/month): daily backups kept for 7 days, restorable from the Supabase dashboard.
2. **Point-in-Time Recovery add-on** (extra cost — confirm price with the owner before turning on): restore to any moment, to the second. Recommended once real invoices and customer data are in.
3. **Weekly off-site copy:** an automatic weekly export of the database to storage *outside* Supabase, so a problem with the Supabase account itself can't take the data with it. To be set up with the live project.

## Restore test — do this when the live project is created, then every 3 months

A backup that has never been restored is only a hope. Each test:

1. Note the time, and count a few things (e.g. number of customers, invoices, users).
2. Restore the latest backup **into a separate, temporary project** (never over the live one).
3. Check the counts match and spot-check 5 records by eye.
4. Check people can sign in to the restored copy.
5. Delete the temporary project.
6. Write the result in `docs/memory/SESSION-LOG.md`: date, how long it took, anything that went wrong.

## If something goes wrong for real

1. **Stop and don't panic-fix.** Note the time the problem started — that's the moment to restore to.
2. Tell the owner. Decide together whether to restore (it rolls *everything* back to that moment).
3. Restore from the Supabase dashboard (Database → Backups), choosing the moment just before the problem.
4. Check counts and sign-in, as in the restore test.
5. Record what happened and why in `SESSION-LOG.md` and, if it changes how we work, `DECISIONS.md`.
