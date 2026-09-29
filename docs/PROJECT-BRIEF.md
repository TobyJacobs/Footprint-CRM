# Footprint Platform — Project Brief

_Draft 2 (owner-reviewed) · 29 September 2026 · Built from the kickoff interview with the project owner. Raw answers are in `docs/memory/INTERVIEW-NOTES.md`._

---

## 1. The goal

Give Footprint Group **one secure, branded, in-house platform** that staff (and later, customers) log in to. It replaces most of the paid tools the business runs on today.

The current tools work. The reason for this project is to have a platform that Footprint **owns and can tailor completely**, and to bring as much as possible in-house (current tools cost about **£2,500 a month**).

### Success looks like
- Staff do their daily work — quoting, invoicing, projects, design workload, magazine bookings — in one place, under one login.
- Old tools are switched off one at a time, **only after their data has been moved and checked**.
- Customer data is secure, GDPR-compliant, and every change is traceable.
- Running costs are well below today's £2,500 a month.

---

## 2. The business in brief

- **Footprint Group** is a full-service marketing agency: signage and vehicle graphics, print, creative design and branding, digital marketing and merchandise.
- It has about **35 staff** across two offices, **Southampton (Swanwick)** and **Swindon**, which do mostly the same work. Most staff are office-based; some work remotely or on site (for example, installs).
- **Forget Me Not** is a monthly Hampshire community magazine: **11 local editions**, hand-delivered by distributors on GPS-tracked routes. Advertising is sold from £18 a month.
- **Your Lead Kit** is Footprint's CRM product for clients — a white-labelled GoHighLevel. **It stays on GoHighLevel** and is not part of this build.
- **Xero** stays as the accounting system: bank feeds, VAT and HMRC, reconciliation and credit control.

---

## 3. Who uses it (users and roles)

- **Staff** — every member of staff has their own login.
- **Customers** — through a **customer portal** (a later wave).
- **Admins** — manage users, teams, roles and permissions through an admin screen.

**Staff log in with their existing Microsoft 365 work account** (the same one they use for Outlook and Teams). Customers log in to the portal separately.

**Each distinct feature has its own place in the navigation menu** (e.g. Customers, Quotes & Invoices, Projects, Design Workload, Magazines). Users only see the sections their role allows.

**Roles are configurable, not built in.** Wave 0 builds the framework: users belong to teams and have roles, and roles grant permissions such as "can see invoices" or "can edit bookings". Admins set up the real teams and people afterwards. Every page and every piece of data checks the user's permissions.

---

## 4. What it does — features by area

### A. Customers (replaces Zoho CRM)
- Customer (company) records, each with **multiple contacts**.
- Each customer's **subscriptions** and **web hosting plans**.
- A **timeline of activity** for each customer: emails sent, quotes, orders, invoices, bookings and notes.
- **Dashboards and analytics** (sales, revenue, pipeline, renewals).

### B. Sales and billing — quote to invoice (replaces Zoho Books)
- **Quotes → sales orders → invoices**, with **purchase orders** to suppliers.
- **Subscription billing** (recurring invoices).
- **Quotes sent digitally and approved digitally**: the customer opens a link, reviews the quote and accepts it online. The acceptance is recorded (who, when) and can turn straight into a sales order.
- **Emailed from the platform** and recorded against the customer.
- **Payments:** card (Stripe), Direct Debit (GoCardless) and bank transfer.
- **Invoices sent to Xero** automatically, as Zoho does today.

### C. Projects and time (replaces Zoho Projects)
- Projects with tasks, assigned users and deadlines.
- **Time tracking** against tasks and projects.

### D. Design workload (replaces monday.com)
- A list of design work items with **status**, **high-priority markers**, **attached drafts** and **notes**.
- Builds on the ideas in the replacement tool built earlier (location to be confirmed).

### E. Magazine publishing (replaces Mag Manager)
- The **full Mag Manager feature set**, including:
  - the 11 editions and monthly issues
  - ad sales and **bookings**
  - **flatplans** (page-by-page plans of each issue)
  - artwork tracking
  - **advertiser billing**, with invoices sent to Xero
- **New: online booking** — advertisers book (and pay for) space themselves, linked to the Forget Me Not website's calculator and "request a space" form.
- **Later stage: distributor management** (details, routes, pay and GPS tracking). Round Control is being rolled out for this now; the platform may absorb it later.

### F. Marketing (replaces Footprint's *own* use of GoHighLevel)
- Footprint's internal campaigns, email/SMS and pipelines. **Scoped later — this is the last wave.**

### G. Customer portal (new)
- Customers log in to see quotes, invoices and bookings, pay online, and (for advertisers) book space.

### H. Reporting and intranet (replaces the existing custom HTML sites)
- Bring the reporting dashboards and intranet content into the platform.

---

## 5. Security and GDPR (non-negotiable)

- **Everyone logs in**, with **two-step login** (a code from a phone app) for every staff account.
- **Role-based access** on every page and every piece of data.
- **An audit log**: a record of who viewed, created, changed or deleted what, and when.
- **Data stored in the UK or EU.**
- **No passwords, keys or customer data in the code** — secrets live only in Netlify's secure settings.
- **Daily automatic backups**, with a tested way to restore them.
- **UK GDPR:** follows Footprint's existing GDPR policy and DPO. Customers' data can be exported or deleted on request, and marketing consent is recorded.
- **Passwords (Zoho Vault):** see section 7.

---

## 6. Moving the data across (migration)

- **About 15,000 customer records**, each with possibly several contacts — **all history to be transferred**.
- Plus quotes, orders, invoices, subscriptions, hosting plans, projects and time logs from Zoho, work items from monday.com, and magazine bookings and billing history from Mag Manager.
- Each old tool's data is moved **as part of the wave that replaces it**. Each move is **rehearsed on a copy first**, then checked (record counts and spot checks by staff) **before the old tool is switched off**.

---

## 7. Out of scope

- **Your Lead Kit** — stays on GoHighLevel.
- **Accounting** — stays in Xero (bank feeds, VAT/HMRC, payroll, credit control).
- **Team chat** — Microsoft Teams replaces Zoho Cliq.
- **Password vault** — **agreed:** use a proven password manager (e.g. 1Password or Bitwarden, about £3–£7 per person a month) rather than build one.
- **Distributor management** — Round Control for now; a possible later stage.

---

## 8. Priorities and order

The owner's order: **Zoho → monday.com → Mag Manager → GoHighLevel (internal use)**. Zoho is split into several waves because it covers several tools. The detailed plan is in `docs/ROADMAP.md`.

---

## 9. Risks

| Risk | Why it matters | How we reduce it |
|---|---|---|
| Size of the project | Replacing five products is a lot for a small team building with Claude. | Small waves. Each one is useful on its own. Old tools stay running until the new part is proven. |
| Data migration errors | 15,000 customers and years of invoices; mistakes damage trust and billing. | Rehearse on copies, check counts, staff spot-checks, keep the old tool read-only for a while. |
| Billing and Xero accuracy | Wrong invoices or broken Xero sync affect cash flow. | Run old and new side by side for one billing cycle before switching. |
| Security breach | Customer and payment data are valuable targets. | Two-step login, role checks, audit log, proven login and payment services (never storing card details ourselves). |
| Mag Manager is specialised | Flatplans and bookings are complex; missing a feature could disrupt an issue. | List every Mag Manager feature with the magazine team before building; switch over between issues. |
| Relying on one person | The owner isn't a developer. | Well-known tools, plain-English docs, memory files in the repo, clear roadmap. |
| Email deliverability | Invoices and quotes landing in spam. | Use a reputable email-sending service with proper domain setup. |

---

## 10. Still to confirm

See `docs/memory/OPEN-QUESTIONS.md`. The key ones:
- renewal dates of the current tools
- which subscriptions are billed today
