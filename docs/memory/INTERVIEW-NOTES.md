# Interview notes — raw answers for the project brief

Working notes from the kickoff interview. These feed into `docs/PROJECT-BRIEF.md`.

## Session 1 — 29 September 2026

### About the business (from footprintgroup.uk)
- Full-service marketing agency: signage and vehicle graphics, print, creative design and branding, digital marketing, merchandise.
- 20+ years in business, 800+ projects delivered.
- Two offices: Southampton (Swanwick Business Centre) and Swindon (Hobley Drive).
- Sells **Your Lead Kit (YLK)**, a CRM and automation product for clients, at £34.99, £85.99 or £257 a month plus VAT, plus a "Done For You" managed service.

### Batch 1 answers
1. **Your Lead Kit** is a white-label version of GoHighLevel.
2. **Magazines:** *Forget Me Not* (https://forgetmenotonline.org), published monthly as **11 separate publications**. The owner publishes them. Managed in Mag Manager.
3. **Staff:** around 35 people. The staff list is on the website. **Role-based access is required.**
4. **Offices:** Southampton and Swindon mostly do the same work. Mainly office-based, with some remote workers and some on-site work (for example, signage installs).
5. **Owner:** the CEO's son, who is leading this project.
6. **Data migration** from the old systems is required once the new platform is ready.

### Batch 2 answers
1. **Your Lead Kit stays on GoHighLevel** for clients. We only replace Footprint's own internal use of GoHighLevel. (See DECISIONS.)
2. **Priority order for replacement:** Zoho first, then monday.com, then Mag Manager, then GoHighLevel last.
3. **Why we're doing this:** the current tools all work. The driver is a fully bespoke, branded, in-house platform that can be tailored completely — not fixing a broken tool.
4. **Zoho Books is used for:** quoting, sales orders, purchase orders, invoicing and **subscription billing** (likely including YLK subscriptions). Invoices are **sent across to Xero**, which does the actual accounts. So bank feeds, VAT/HMRC and payroll are **not** in scope — Xero stays.
5. **Budget:** current tools cost about **£2,500 a month**. The goal is to bring as much in-house as possible.
