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
