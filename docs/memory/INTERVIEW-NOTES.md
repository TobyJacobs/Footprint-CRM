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

### Forget Me Not (from forgetmenotonline.org)
- Hampshire community magazine, **11 area editions**, about 5,000 homes each, about **55,000 homes a month** in total. _(The Footprint About page says "over 100,000 homes" — to check which is current.)_
- **Hand-delivered by distributors on GPS-tracked routes.** Distributors are recruited through the website. This means distributor records, routes and pay may need to be managed too.
- Adverts from £18 a month. The site has a cost calculator and a "request a space" form. Footprint's design team can create the adverts.
- Reader features: Pets Corner photos, competitions, and a local business directory.
- Based at the Swanwick office.

### Leadership (from footprintgroup.uk/about-us)
- A board of 3 directors plus a Marketing Director. The website doesn't list the wider staff.

### Batch 2 answers
1. **Your Lead Kit stays on GoHighLevel** for clients. We only replace Footprint's own internal use of GoHighLevel. (See DECISIONS.)
2. **Priority order for replacement:** Zoho first, then monday.com, then Mag Manager, then GoHighLevel last.
3. **Why we're doing this:** the current tools all work. The driver is a fully bespoke, branded, in-house platform that can be tailored completely — not fixing a broken tool.
4. **Zoho Books is used for:** quoting, sales orders, purchase orders, invoicing and **subscription billing** (likely including YLK subscriptions). Invoices are **sent across to Xero**, which does the actual accounts. So bank feeds, VAT/HMRC and payroll are **not** in scope — Xero stays.
5. **Budget:** current tools cost about **£2,500 a month**. The goal is to bring as much in-house as possible.

### Batch 3 answers
1. **Users, teams and roles:** build the *framework* (users, teams, roles, permissions) in Wave 0. Actual people and teams are added manually later through an admin screen — nothing hard-coded.
2. **Zoho CRM** is mainly used for:
   - feeding Zoho Books (customer records)
   - recording **subscriptions** and **web hosting plans** per client
   - **dashboards and analytics**

   All of this needs replacing. The core day-to-day **quote → invoice** work happens in **Zoho Books**.

   **Zoho Projects** is task-based: projects with tasks, users assigned to each, and **time tracked** against them.
3. **Zoho Cliq:** fine to use **Microsoft Teams** instead if a built-in messenger would be a lot of work. → Chat is out of scope (see DECISIONS).
4. **monday.com (design team):** a list of work items, each with a status, a **high-priority marker**, attached drafts and notes. Claude built a replacement tool recently (not yet adopted). Its code isn't in this repo or in `Documents\claude` — ask the owner where it lives so we can reuse its ideas.
5. **Mag Manager:** the **full feature set** is used, including billing. It generates advertiser invoices, which are sent across to **Xero** for reconciliation and credit control. Wish list: **online bookings** (advertisers booking and paying for space themselves; the Forget Me Not site already has a "request a space" form and a cost calculator).

### Batch 4 answers
1. **Customer portal wanted:** customers (clients and advertisers) get their own login. Details to be shaped later, e.g. quotes, invoices, bookings.
2. **Email:** quotes, invoices and other emails are sent **from the platform** and **recorded against the customer**. _(Microsoft 365 not confirmed — see OPEN-QUESTIONS.)_
3. **Payments:** customers pay by a mix of **bank transfer, card and Direct Debit**, using **Stripe** (card) and **GoCardless** (Direct Debit).
4. **Data migration:** about **15,000 customer records**, each with possibly several contacts. **All history** is to be transferred.
5. **Security and GDPR:**
   - There is a **DPO or GDPR policy** in place.
   - **Two-step login for everyone** is wanted.
   - **An audit log** of who viewed or changed what is wanted.
   - **UK or EU data storage** is acceptable.

### Technical context noticed
- The owner's other projects in `Documents\claude\netlify` already use **Netlify Functions + Supabase** (a hosted database with logins built in) and a Microsoft Outlook connection. They're familiar tools, so they're a strong candidate for the foundations.
