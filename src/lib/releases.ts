// FootprintOS versions: what changed in each, in plain English, newest first.
// The first entry is the version shown in the side menu.
//
// Numbering (owner, 26 October 2026): 0.x until Go-live, then 1.0.
// - New feature or change people will notice: next middle number (0.20.0 → 0.21.0).
// - Fix only: next last number (0.21.0 → 0.21.1).
// Add an entry in the same pull request as the change, and keep
// package.json's "version" the same as the first entry here.

export type Release = { version: string; date: string; title: string; changes: string[] };

export const releases: Release[] = [
  {
    version: "0.34.0",
    date: "2026-10-27",
    title: "Magazine renewals",
    changes: [
      "New Magazines → Renewals tab: for any month, every advertiser who booked an earlier issue but nothing this month, scored like Mag Manager (booked last month 20, 2 months ago 16, 3 months ago 12, 4–6 months ago 8, 7–12 months ago 4; one less if they already have later bookings), with the opportunity (what they spent last time).",
      "Filter by salesperson; mark each one Contacted, Carried forward or Definitely out with a note (Definitely out keeps them off later months until they book again); start a new advertising quote in one click.",
    ],
  },
  {
    version: "0.33.0",
    date: "2026-10-27",
    title: "Drag design jobs on the board",
    changes: [
      "Design Workload → Board: drag a job card onto another column to move it to that stage. The column lights up pink while you hover over it.",
      "Works with a mouse on a computer. On a phone or tablet, use the \"Move to …\" button on each card as before.",
    ],
  },
  {
    version: "0.32.0",
    date: "2026-10-27",
    title: "Magazines, part 2: artwork and monthly invoicing",
    changes: [
      "Advert artwork uses the same design queue as everything else: on a sales order with adverts, choose “We'll design it”, “Customer is supplying it” or “Same as last time” for each advert size. Each makes a job on the Design board with the editions, months, size and copy deadline filled in. Adverts don't need a project.",
      "Magazines dashboard: each advert shows its artwork status and invoice.",
      "Invoicing issue by issue: “Create invoices for [month]” makes one draft invoice per order with just that month's adverts, using each customer's payment terms. Nothing is billed twice, and the order becomes Invoiced once it's all billed.",
    ],
  },
  {
    version: "0.31.0",
    date: "2026-10-27",
    title: "Magazines, part 1",
    changes: [
      "New Magazines dashboard: for any month, each Forget Me Not edition's pages, adverts booked (in pages and £), sales target reached, revenue per page and what's still at quote, plus the list of adverts.",
      "Magazines → Setup: the 11 editions (homes, usual pages, monthly target), each month's issues (pages, copy deadline, target, complete) and the advert sizes (mm, part of a page, usual price for when the rate card arrives).",
      "Advertising quotes now book real editions, months and sizes: one line per edition per month, which carries through to the sales order and invoices.",
      "Fix: adding a sales order line for a customer with no services ticked could fail to save.",
    ],
  },
  {
    version: "0.30.0",
    date: "2026-10-27",
    title: "Portal sign-in code",
    changes: [
      "Customer portal: the sign-in email now has a 6-digit code as well as the button. Read the email on your phone and type the code on your laptop (the button only signs in the device you open it on).",
      "The code works once, for 30 minutes, and stops working after 5 wrong tries.",
    ],
  },
  {
    version: "0.29.0",
    date: "2026-10-27",
    title: "Portal: marketing and customer support",
    changes: [
      "Customer portal: customers now see their marketing too: retainers, ad campaigns (budget, spend so far, leads and results) and their content calendar (not early ideas). No internal notes.",
      "Customer portal: a Support section where customers send a change request or a question, and follow the conversation.",
      "New Customer support tab: messages arrive here and admins get an email. Reply in FootprintOS (the customer sees it in their portal and gets an email), and mark each one New, In progress or Done. Admins can give other roles access in Admin → Roles.",
    ],
  },
  {
    version: "0.28.0",
    date: "2026-10-27",
    title: "Customer portal (first half)",
    changes: [
      "Customers can sign in at /portal with a one-time link emailed to them. Anyone listed as a contact with that email can sign in; no passwords.",
      "They see their own company's quotes (sent, accepted and declined, never drafts) and can open, accept or decline them, plus their hosting plans. Nothing from any other customer, and no internal notes, logins or costs.",
      "Removing a contact's email (or the contact) stops them signing in straight away.",
    ],
  },
  {
    version: "0.27.0",
    date: "2026-10-26",
    title: "Customer projects at the bottom",
    changes: [
      "Customer page: Projects moved to the bottom, full width, below everything else.",
      "Projects are listed by number and name (with status and due date), without the “Order SO-…” wording that made them look like sales orders.",
    ],
  },
  {
    version: "0.26.0",
    date: "2026-10-26",
    title: "Just a copy link button",
    changes: [
      "Quotes, orders and invoices no longer have a customer link box: there's a single “Copy approval link” (quotes) or “Copy customer link” button at the top, next to Download PDF.",
    ],
  },
  {
    version: "0.25.0",
    date: "2026-10-26",
    title: "A cleaner sales flow",
    changes: [
      "Quotes have a stage bar too: Draft → Sent → Accepted → Sales order, with the next step highlighted (a declined quote shows in red).",
      "“Mark declined” asks why the quote was lost, so the reason is always recorded; it's no longer a box on the quote form.",
      "Probability and Expected order are tucked under “More details” on the quote form.",
      "Sales orders no longer have the old “Production step”: the stage bar shows where an order is. The Operations dashboard groups open orders by the same stages.",
    ],
  },
  {
    version: "0.24.0",
    date: "2026-10-26",
    title: "Part billing",
    changes: [
      "Sales orders can be invoiced in parts: enter an amount before VAT (e.g. £1,000) or a percentage (e.g. 50%) and a part invoice is made with one clear line, VAT worked out as on the order.",
      "The order shows how much has been invoiced and how much is still to invoice, and “Invoice the rest” bills what's left.",
      "An order only counts as Invoiced once everything has been billed; the stage bar shows “Part invoiced” until then.",
    ],
  },
  {
    version: "0.23.0",
    date: "2026-10-26",
    title: "Warehouse on sales orders",
    changes: [
      "Sales orders say which warehouse they go out from or are collected from: Swanwick or Swindon.",
      "It shows on the order page, the printed order, the PDF and the customer's copy; choosing “Collect from Footprint” names the warehouse.",
    ],
  },
  {
    version: "0.22.0",
    date: "2026-10-26",
    title: "Order addresses and delivery",
    changes: [
      "Sales orders have their own billing address, delivery address and delivery notes, filled in from the customer and changeable on the order.",
      "“Deliver to” picks the customer's shipping or billing address, one of their contacts' addresses, collection from Footprint, or a different address.",
      "The addresses show on the order page, the printed order and PDF, and the customer's online copy; the billing address carries over to the invoice.",
    ],
  },
  {
    version: "0.21.0",
    date: "2026-10-26",
    title: "Sales order stages",
    changes: [
      "Sales orders: a stage bar at the top (Order received → Project → Design → Suppliers ordered → Completed → Invoiced) that lights up by itself and highlights where the order is now.",
      "Sales orders are laid out in sections: Stage, Finance summary (bars for value, cost, margin, supplier orders and how much is invoiced), Purchase orders, Design work, Project and Comms.",
    ],
  },
  {
    version: "0.20.0",
    date: "2026-10-26",
    title: "The full sales flow",
    changes: [
      "Versions: FootprintOS now has a version number (bottom of the side menu) and this What's new page.",
      "New quote: a “What kind of quote?” dropdown (Quote, Advertising, Proposal) that switches the screen to match.",
      "Customer page: New quote, New advertising quote and New proposal buttons, straight to the right form.",
      "Sales orders: Create project, Request design and Order from suppliers buttons, in that order. Projects are no longer made automatically.",
      "Pipeline: draft opportunities shown in their own highlighted area, kept out of the win rate and totals.",
      "Sign-in always comes back to the main FootprintOS address.",
    ],
  },
  {
    version: "0.19.0",
    date: "2026-10-21",
    title: "Quotes, emails and PDFs",
    changes: [
      "Sales and Operations are now two separate sections in the menu.",
      "Send quote: emails the quote to the contact straight away, with the PDF attached. Every quote, order and invoice email now carries its PDF, and each has a Download PDF button.",
      "Customer links are copy buttons only; the email box sits below the document.",
      "Margin shown in pounds and as a percentage everywhere; no product numbers on quotes, orders or invoices.",
      "Customer page: quotes, sales orders and invoices in separate boxes.",
      "Quote types (Quote, Advertising, Proposal) and business units; labour cost sits with the quote lines.",
      "Emails: no tracked links, and replies go to the person who sent them.",
      "Fix: quotes with a line that has no cost can be saved again.",
    ],
  },
  {
    version: "0.18.0",
    date: "2026-10-20",
    title: "Customers at a glance",
    changes: [
      "Customer at a glance: spend, money owed and quotes on every customer.",
      "Customer action buttons: sell, work and contact in one click.",
      "Contact address chosen from the customer's addresses.",
      "Quote lines: cost before sell, with margin per line.",
      "Design jobs are started from projects.",
    ],
  },
  {
    version: "0.17.0",
    date: "2026-10-19",
    title: "Design Workload and FootprintAI",
    changes: [
      "Design Workload: job board, proofs and notes, replacing monday.com.",
      "Customers approve design proofs online.",
      "FootprintAI: invite-only section for the Footprint AI programme, with live scorecards.",
      "A friendly message when FootprintOS is updated while a page is open.",
      "Invoice safety: status rules, no double conversion, a failed email leaves a draft.",
    ],
  },
  {
    version: "0.16.0",
    date: "2026-10-15",
    title: "Dashboards and Marketing",
    changes: [
      "Dashboards: Revenue, Pipeline, Renewals and Time.",
      "Profit after time, using hourly costs per role.",
      "Marketing team workspace and home page.",
      "Faster, smoother pages: loading screens, progress bar and busy buttons.",
    ],
  },
  {
    version: "0.15.0",
    date: "2026-10-14",
    title: "The foundations",
    changes: [
      "Everything before versions began: secure sign-in with Microsoft, staff, roles and permissions, Customers, Quote to Invoice, purchase orders, the product list, Projects & Time, the Staff hub and the Roadmap.",
    ],
  },
];

export const currentVersion = releases[0].version;
