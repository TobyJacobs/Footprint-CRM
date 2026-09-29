# Decisions log

Every important decision, dated, with the reason. Never delete entries — if a decision changes, add a new entry that replaces it and say which one it replaces.

---

## 29 September 2026 — Keep Claude's memory inside the repository
**Decision:** Claude's memory lives in `docs/memory/` and is pushed to GitHub.
**Why:** It's backed up automatically, has full history, and isn't lost if a computer or chat session is.

## 29 September 2026 — Your Lead Kit stays on GoHighLevel
**Decision:** The client-facing Your Lead Kit product stays on white-label GoHighLevel. The new platform only replaces Footprint's own internal use of GoHighLevel.
**Why:** Rebuilding a paid product that clients log in to is a far bigger, riskier job, and not what the business needs first.

## 29 September 2026 — Xero stays as the accounts system
**Decision:** Xero remains the accounting system (bank feeds, VAT/HMRC, reporting). The new platform replaces Zoho Books' quoting, orders, purchase orders, invoicing and subscription billing, and sends invoices to Xero as Zoho does today.
**Why:** That's how the business works now. Building accounting and HMRC filing ourselves would add risk and cost for no gain.

## 29 September 2026 — Team chat stays outside the platform
**Decision:** Zoho Cliq will be replaced by Microsoft Teams, not a chat built into the platform.
**Why:** Building a good real-time messenger is a lot of work for little gain. Teams is proven and the owner is happy to use it.

## 29 September 2026 — Users, teams and roles are configurable, not hard-coded
**Decision:** Wave 0 builds the framework for users, teams, roles and permissions. Admins add real people and teams later through an admin screen.
**Why:** The owner's request. It lets the organisation change without code changes.

## 29 September 2026 — Order of replacement
**Decision:** Replace Zoho first, then monday.com, then Mag Manager, then GoHighLevel (internal use) last.
**Why:** The owner's priority. The main driver is a bespoke, branded in-house platform, not a failing tool.
