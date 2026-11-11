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
    version: "0.85.1",
    date: "2026-11-11",
    title: "Friendlier thank-you on accepted quotes",
    changes: ["After a customer accepts a quote online, the thank-you box now says \"We'll be in touch to get things moving\" instead of naming the company."],
  },
  {
    version: "0.85.0",
    date: "2026-11-11",
    title: "Design jobs from an order or a project",
    changes: [
      "Create design job on a sales order now goes straight to the form, even if the order has no project. The job is linked to the order and its customer. You no longer have to create a project first.",
      "Jobs can still be raised from a project, with or without a sales order. New design job on the Design board lets you choose a project or a sales order.",
    ],
  },
  {
    version: "0.84.0",
    date: "2026-11-11",
    title: "Colours on the order progress bar",
    changes: [
      "Suppliers ordered turns amber once items are ordered from suppliers (waiting for goods, with how many purchase orders are received) and green once all the goods are in.",
      "Invoiced turns amber when the order is part invoiced or not everything has been paid, and green saying Paid once every invoice is paid.",
    ],
  },
  {
    version: "0.83.0",
    date: "2026-11-11",
    title: "Purchasing summary",
    changes: ["Sales orders have a Purchasing summary block: for each item, how many are needed, ordered from suppliers, on draft purchase orders, and still to order, plus what it should cost against what we bought it for. A badge says how many items are still to order, with a button to raise POs for what's left."],
  },
  {
    version: "0.82.0",
    date: "2026-11-11",
    title: "Quantity bought on purchase orders",
    changes: [
      "Purchase order lines have a Qty bought box next to the quantity ordered, for when a supplier can't supply them all (e.g. only 5 of 10 in stock). The line shows how many are short, and the bought-for total and difference use the quantity actually bought.",
      "When anything is short, Order the shortfall lets you pick another supplier and makes a new draft purchase order for just the missing quantities, linked to the same sales order.",
    ],
  },
  {
    version: "0.81.0",
    date: "2026-11-11",
    title: "Should cost vs bought for on purchase orders",
    changes: ["Each purchase order line shows what it should cost and, once you enter it from the supplier's bill, what we bought it for, with the difference per line and in total (red when it cost more, blue when it cost less). Enter the figures in the Bought for column and click Save what we paid."],
  },
  {
    version: "0.80.0",
    date: "2026-11-11",
    title: "Supplier per line on purchase orders",
    changes: [
      "Raise POs on a sales order now opens a list of the order's lines where you pick the supplier for each one (it starts with the product's usual supplier, or Not needed). You get one purchase order per supplier with just their lines.",
      "A purchase order can be emailed to the supplier as before, or marked as ordered manually: by phone, on their website, in person or another way, with a note. The purchase order shows how it was ordered, by whom and when.",
    ],
  },
  {
    version: "0.79.1",
    date: "2026-11-11",
    title: "Order confirmation fix",
    changes: [
      "Fixed: when a customer accepts a quote online and the quote's contact has no email address, the order confirmation now goes to the customer's own email address (or the address the quote was sent to). Before, it wasn't sent at all.",
      "Send quote, Save and resend and the email box also use the customer's email address when the contact has none.",
    ],
  },
  {
    version: "0.79.0",
    date: "2026-11-11",
    title: "GP override reasons",
    changes: ["When you override the gross profit on a line, the reason is now picked from a list: Supplier cost was wrong, Discount agreed, Goodwill / complaint, Bundle or package deal, or Other (with a note to explain). You can add a note to any reason."],
  },
  {
    version: "0.78.0",
    date: "2026-11-11",
    title: "No project needed",
    changes: ["A sales order's Project box has a No project needed button. The order's stage bar then shows Project as not needed and moves on to the next step (also on the Operations dashboard). You can undo it, and still create a project later."],
  },
  {
    version: "0.77.2",
    date: "2026-11-11",
    title: "Addresses on automatic orders",
    changes: ["Fixed: when a customer accepts a quote online, the sales order made for them now has the customer's billing and delivery addresses filled in (before, they were left blank). Orders made with Convert to sales order already did this."],
  },
  {
    version: "0.77.1",
    date: "2026-11-11",
    title: "Accepted stays blue",
    changes: ["A quote's Accepted step is blue again, like every other finished step. Pending acceptance stays amber while you wait for the customer."],
  },
  {
    version: "0.77.0",
    date: "2026-11-11",
    title: "Pending acceptance on quotes",
    changes: ["A quote's progress bar now shows Pending acceptance in amber once it's been sent, while you wait for the customer, and turns green saying Accepted once they accept."],
  },
  {
    version: "0.76.1",
    date: "2026-11-11",
    title: "Contact due fix",
    changes: ["Fixed: the Contact due flag now shows what the customer previously ordered (it wrongly said \"No orders yet\"). The Contact due badge on the Customers list no longer splits over two lines."],
  },
  {
    version: "0.76.0",
    date: "2026-11-11",
    title: "Contact due: past orders and customer list",
    changes: [
      "The Contact due flag on Customer at a glance now says what the customer previously ordered (their latest order or invoice, with a link), so whoever calls has something to talk about.",
      "The Customers list shows a Contact due badge next to those customers, and a Contact due only tick box to list just them.",
    ],
  },
  {
    version: "0.75.0",
    date: "2026-11-11",
    title: "Contact due flag",
    changes: ["Customer at a glance shows a Contact due flag when nothing has been logged on the customer's timeline for over 3 months (or ever), with a Log a call link."],
  },
  {
    version: "0.74.0",
    date: "2026-11-11",
    title: "Board actions for Directors only",
    changes: [
      "FootprintAI: Board only actions can now be seen only by people with the Directors role. Before, every admin could see them too. Only Directors can make an action Board only.",
      "Customer timeline: entries made automatically (such as sales orders from accepted quotes) now say \"Automatic\" instead of \"system\", including in Last activity.",
    ],
  },
  {
    version: "0.73.0",
    date: "2026-11-11",
    title: "Last activity on customers",
    changes: ["A customer's Details now show Last activity: the newest entry on their timeline (call, email, meeting or note), when it was and who logged it. Click it to jump to the timeline. It replaces the old \"Last contacted\" date, which had to be typed in by hand."],
  },
  {
    version: "0.72.0",
    date: "2026-11-11",
    title: "Credit status fills in invoice terms",
    changes: ["On a customer's form, picking a credit status fills in when their invoices are due: Net 7, 14, 30 or 60 sets that many days after the bill date, and Upfront payment sets 0 (due on the bill date). You can still change it."],
  },
  {
    version: "0.71.0",
    date: "2026-11-11",
    title: "Simpler credit status",
    changes: [
      "Credit status uses shorter wording: Net 7, Net 14, Net 30 and Net 60 instead of \"… Day Terms Available to Client\", and \"Upfront payment\" instead of \"Payment Required before we order goods\".",
      "The Direct Debit and No Credit Available options are gone. Customers who were \"No Credit Available\" are now \"Upfront payment\" (they still get the pay-first warning on quotes and orders); \"Direct Debit\" was cleared, as Direct Debit has its own field.",
    ],
  },
  {
    version: "0.70.1",
    date: "2026-11-11",
    title: "One Direct Debit field",
    changes: ["Customers have one Direct Debit field (its \"FMN Active\" option covers Forget Me Not). The separate Direct Debit – Forget Me Not field is gone from the customer page, the form and the Direct Debits report (it was empty)."],
  },
  {
    version: "0.70.0",
    date: "2026-11-11",
    title: "Copy billing address",
    changes: ["A customer's page has a Copy billing address button. It copies the customer's name and address, one line each, ready to paste."],
  },
  {
    version: "0.69.0",
    date: "2026-11-11",
    title: "Order confirmation email",
    changes: [
      "When a customer accepts a quote online, they're now emailed an order confirmation straight away: their sales order number, what they've ordered and the totals, with a link to view the order. Replies go to the salesperson, and it shows in the order's email history.",
      "Orders made automatically from an accepted quote now keep its line types (one-off, monthly, included) and a proposal's payment plan and deposit.",
    ],
  },
  {
    version: "0.68.0",
    date: "2026-11-09",
    title: "Open the sales order from a quote",
    changes: ["On a quote that's become an order, the Sales order step in the progress bar is now a link: click it to open the order."],
  },
  {
    version: "0.67.0",
    date: "2026-11-09",
    title: "Terms presets",
    changes: [
      "The Terms box on quotes, advertising quotes, proposals, sales orders and invoices has a Use preset… list: pick a saved set of terms to fill the box, then edit if needed.",
      "Admins manage the presets in Admin → Terms: name, the terms, and which documents each is offered on. It starts with the standard proposal terms and your current quote, order and invoice terms.",
    ],
  },
  {
    version: "0.66.0",
    date: "2026-11-09",
    title: "Save and resend",
    changes: ["Editing a quote: Save and resend saves your changes and emails the updated quote, with its PDF, to the contact again (the subject starts \"Updated:\"). Save changes still just saves."],
  },
  {
    version: "0.65.0",
    date: "2026-11-09",
    title: "Probability and expected order required",
    changes: ["Every quote now needs a Probability (Low, Confident, Definite) and an Expected order (This month, Next month, Future). They're always shown on the quote form, and it can't be saved or sent without them."],
  },
  {
    version: "0.64.0",
    date: "2026-11-09",
    title: "Margin on cost",
    changes: [
      "Margin % now means profit as a % of the cost everywhere in FootprintOS: double the cost is 100%, the standard 2.5 × cost is 150%. That covers quote and order lines and totals, quote lists, products, the sales overview, dashboards, reports, projects and the time dashboard.",
      "The margin box on a line goes up to 100,000%. Type a margin to set the sell price (e.g. 150% on a £40 cost = £100).",
      "Lines or quotes with no cost show a blank margin instead of 100%. The margin target in Admin → Targets can be over 100%.",
    ],
  },
  {
    version: "0.63.1",
    date: "2026-11-09",
    title: "Fix: product list on quote lines",
    changes: ["Choosing a product on a quote, order or invoice line: the list now floats over the page and shows many products at once (it was cut off by the lines table, showing about one). It opens upwards if there isn't room below."],
  },
  {
    version: "0.63.0",
    date: "2026-11-09",
    title: "Standard margin button",
    changes: ["Quotes, orders and invoices: Apply standard margin sets every line with a cost to 2.5 × cost (a 60% margin) in one click. Lines without a cost, or with a locked GP, are left alone, and you can still change any price."],
  },
  {
    version: "0.62.0",
    date: "2026-11-09",
    title: "Proposals like the quote builder",
    changes: [
      "Proposals now work like Footprint's quote builder (quotes.footprintgroup.uk): pick products and services from the catalogue by group, or add your own; each line is One-off, Monthly or Included.",
      "Separate one-off and monthly totals, a payment plan for one-off costs (pay in full, or 3, 6 or 9 months at 0%), and a 25% or 50% deposit on acceptance.",
      "The customer's proposal (link, PDF and print) shows the payment schedule, next steps and Footprint's standard terms (editable), in the same layout as the quote builder. Orders made from a proposal keep its payment plan.",
      "Products have a Type (one-off, monthly, included) and a Proposal catalogue group. The 22 quote builder products are loaded.",
    ],
  },
  {
    version: "0.61.0",
    date: "2026-11-09",
    title: "Customer timeline moved",
    changes: ["A customer's Timeline now sits in the main column below Digital retainers, and its entries scroll in a box instead of running down the page."],
  },
  {
    version: "0.60.0",
    date: "2026-11-09",
    title: "Copy email",
    changes: ["Email this customer: a Copy email button in place of Open in my email app. It copies the message to paste into any email."],
  },
  {
    version: "0.59.0",
    date: "2026-11-09",
    title: "Email delivery confirmation",
    changes: [
      "Emails sent from quotes, orders, invoices, purchase orders and customers now show what happened after they left: Delivered ✓ (reached the customer's mail server), Delayed, Bounced, Not delivered or Marked as spam, with the reason.",
      "If an email bounces, whoever sent it gets an email saying so, with a link to fix the address and send it again.",
      "Needs SendGrid's delivery reports switched on once (Event Webhook). Until then, emails show \"Sent · waiting for the delivery report\".",
    ],
  },
  {
    version: "0.58.0",
    date: "2026-11-09",
    title: "Branded emails",
    changes: [
      "Every email FootprintOS sends now has the Footprint Group look: the logo at the top, the brand stripe, and a footer with footprintgroup.uk. That covers quotes, invoices, orders, purchase orders, design proofs, customer emails, portal sign-in codes, support replies, staff invites, and enquiry and chat alerts.",
    ],
  },
  {
    version: "0.57.0",
    date: "2026-11-09",
    title: "Contacts on one line",
    changes: ["A customer's contacts are listed one per line: name, job title, email and phone side by side (they wrap on a phone)."],
  },
  {
    version: "0.56.0",
    date: "2026-11-09",
    title: "Tidier customers",
    changes: [
      "Customers no longer show a status (Active, Cancelled…) or the Sales & marketing box, on the customer's page, the edit form or the customer list. Anything already recorded is kept.",
    ],
  },
  {
    version: "0.55.0",
    date: "2026-11-09",
    title: "Simpler customer addresses and account managers",
    changes: [
      "Adding or editing a customer shows just the billing address. Choose \"Use a different address than the billing address\" to add a separate delivery address.",
      "When it's the same, the billing address is used for deliveries, and the customer's page says \"Same as billing address\".",
      "Customer at a glance only lists the account managers who are set (for example, no Advertising line if there's no advertising account manager).",
    ],
  },
  {
    version: "0.54.0",
    date: "2026-11-09",
    title: "Account managers per area",
    changes: [
      "Customer at a glance now shows the customer's account managers: the main one, plus one for each area (Advertising, Marketing, Print/Merch, Signage, Footprint AI).",
      "Anyone who can edit customers can change them with Change account managers. \"Account owner\" is now called the main account manager.",
    ],
  },
  {
    version: "0.53.0",
    date: "2026-11-09",
    title: "Simpler customer buttons",
    changes: [
      "A customer's quick buttons are shorter: one New quote button (the quote form asks which kind: standard, advertising or proposal), plus New sales order, New invoice, New project and New content item.",
      "Email customer, Log a call and Add contact are now in one Contact dropdown.",
    ],
  },
  {
    version: "0.52.1",
    date: "2026-11-09",
    title: "Fix: website chat window",
    changes: ["The website chat window no longer shows \"Something went wrong\" after the first reply."],
  },
  {
    version: "0.52.0",
    date: "2026-11-09",
    title: "Website chat",
    changes: [
      "A chat bubble for footprintgroup.uk and forgetmenotonline.org, in place of the GoHighLevel chat. A Grok bot answers from what you tell it about the business, and hands anything complex to a person.",
      "When a chat needs a person, the visitor leaves their name, email and phone. It becomes a lead and the chosen people get the whole chat by email.",
      "Customer support has a new Website chat tab: read every chat and mark it as dealt with. The count shows chats that need a person.",
      "Set up each website's chat box in Lead pipelines → Website chat: greeting, what the bot knows, pipeline, who is emailed, and the code for the website. Until an xAI key is added, every chat goes straight to leave-your-details.",
    ],
  },
  {
    version: "0.51.0",
    date: "2026-11-09",
    title: "Word search themes",
    changes: [
      "Making a word search: type a theme and click Suggest words to fill in words for it from 51 ready-made themes (Christmas, Easter, the seasons, garden birds, Hampshire places, the seaside, sports and more). Then delete any you don't want and add your own.",
      "Each suggestion picks a different mix of words, only ones that fit the grid you've chosen. No outside service and no cost.",
    ],
  },
  {
    version: "0.50.1",
    date: "2026-11-09",
    title: "Fix: tidier GOV.UK articles",
    changes: ["Articles saved from GOV.UK no longer have empty bullet points: each bullet's text stays on its own line."],
  },
  {
    version: "0.50.0",
    date: "2026-11-09",
    title: "Magazine content library",
    changes: [
      "New Magazines → Content tab: puzzles and free articles ready to fill pages not sold as adverts.",
      "Puzzles: make word searches and sudoku as drafts, preview them, and use the same one in as many editions as you like. Each issue gets the puzzle on one page and the answers on another.",
      "Free articles only: search GOV.UK and save articles (free to reuse; print the credit line shown with it), or write your own. Edit to shorten, download the text, and put them on any issue's page.",
      "Flatplans can add puzzles and articles from the library, and Take off this issue now leaves the puzzle in the library.",
    ],
  },
  {
    version: "0.49.0",
    date: "2026-11-09",
    title: "Puzzles for the magazine",
    changes: [
      "Flatplans have a Puzzles box: FootprintOS makes a word search (from your own words, e.g. a theme like Garden birds) or a sudoku, easy, medium or hard, and puts it on the page you choose.",
      "The answers go on a different page of the same issue (the last inside page unless you pick another), and the puzzle says which page.",
      "Download the puzzle and the answers as print-ready PDFs at the exact size of their space, ready for the page layout. Not keen on one? Make a new one with the same words.",
    ],
  },
  {
    version: "0.48.0",
    date: "2026-11-06",
    title: "Advert deposits",
    changes: [
      "Forget Me Not adverts, as on the website: if the first advert is 3 or more months away, the customer can pay a 25% deposit when they confirm and the rest before the first print deadline; otherwise they pay in full. There are no contracts.",
      "Advert quotes show the payment option, to staff and on the customer's quote page.",
      "Advert orders have a Payment box: Invoice the 25% deposit, then Invoice the balance (due by the first advert month's copy deadline). Orders paid this way are left out of Create invoices for [month], so nothing is billed twice.",
    ],
  },
  {
    version: "0.47.1",
    date: "2026-11-06",
    title: "Fix: rate card matches the website calculator",
    changes: [
      "Advertising quotes now round each edition's rate-card price to whole pounds (for example £116.60 becomes £117), so totals match the Forget Me Not website calculator and the sales spreadsheet.",
      "Two thirds page, 6 months or more, 4th area corrected to £74.",
    ],
  },
  {
    version: "0.47.0",
    date: "2026-11-03",
    title: "Magazine rate card",
    changes: [
      "Advertising quotes now price themselves from the 2026 rate card: the first edition at the 1st-area price, the second at the 2nd-area price and so on, with the cheaper rate for 6 months or more. Premium positions (front and back cover, inside covers, first page, centre spread) use their own prices. You can still type a different price.",
      "Magazines → Setup: the rate card for each year (view and correct any price), and which rate-card row each advert size is priced as. Three quarter page and the double small ad have no rate-card price yet.",
    ],
  },
  {
    version: "0.46.1",
    date: "2026-11-02",
    title: "Fix: flatplan page items",
    changes: ["Adverts and editorial now show at their size on flatplan pages (they were drawn with no size after the last update)."],
  },
  {
    version: "0.46.0",
    date: "2026-11-02",
    title: "Lay out each flatplan page",
    changes: [
      "Flatplan pages are now drawn to scale (130 × 190 mm), with each advert shown at its booked size: full page, half page, quarter page and so on. Drag an advert or editorial to the exact spot it goes, on the same page or another one; it snaps to 5 mm.",
      "Overlapping items are shown in red, and so is the page.",
      "Editorial items use the same sizes as adverts (or a full or double page), and their size can be changed after adding them.",
    ],
  },
  {
    version: "0.45.0",
    date: "2026-11-02",
    title: "Upload pages on the flatplan",
    changes: [
      "Each page on a flatplan now has its own Upload page button for its finished file (PDF, JPG or PNG), in place of uploading one PDF for the whole issue. You can see which pages are done, open them, replace them or remove them.",
      "Once every page is uploaded, Put the flipbook online publishes the page-turning flipbook, built from the pages in order. Replacing a page updates it straight away.",
      "On the Magazines dashboard, click an edition's name to open its flatplan (the separate Flatplan link has gone).",
    ],
  },
  {
    version: "0.44.0",
    date: "2026-11-01",
    title: "Magazine reports: bookings and financial",
    changes: [
      "New Bookings report (Reports, Magazines access): every Forget Me Not advert booked, grouped by issue, month, edition, salesperson, customer, category, section, advert size or premium position, with filters, a list of every advert and a CSV download. Click a customer to see just their bookings.",
      "New Invoices, VAT (cash) and Direct Debits reports. VAT on a cash basis counts invoices when they're marked paid and credit notes when issued, by VAT rate.",
      "Magazines → Setup has two new lists: advertiser categories (set on each customer) and magazine sections. When adding adverts to a quote you can now choose a section and a premium position (e.g. Back cover); they stay with the order.",
    ],
  },
  {
    version: "0.43.0",
    date: "2026-11-01",
    title: "Website enquiry forms",
    changes: [
      "New Website forms (Lead pipelines → Website forms, Marketing): enquiry forms for Footprint's own websites, in place of the GoHighLevel forms. Choose which pipeline each form feeds, who owns the leads and who's emailed, the wording and which details to ask for.",
      "Each form has code to paste into a website (it works on footprintgroup.uk and forgetmenotonline.org) and its own link. Every enquiry becomes a lead in the first stage, with the message in its notes and “Website form” as where it came from; if that person already has an open lead in the pipeline, the message is added to it instead.",
      "Spam protection is built in: a hidden trap for bots and limits on how often one person can send.",
    ],
  },
  {
    version: "0.42.0",
    date: "2026-10-30",
    title: "Lead pipelines",
    changes: [
      "New Lead pipelines (a tab in both Marketing and Sales): leads before they're quotes, on one board per business area: Print/Merch, Signage, Advertising (Forget Me Not) and FootprintAI. Drag a card from stage to stage (New lead → Contacted → Meeting booked → Quote sent → Won / Lost).",
      "Each lead has its contact details, where it came from, what it's worth, an owner and a follow-up date (red when due). “Make customer and quote” turns it into a customer (or links the existing one with that email) and starts a quote.",
      "Marketing can rename, reorder and add stages and pipelines. Sales staff who see only their own records see their own and unassigned leads.",
    ],
  },
  {
    version: "0.41.0",
    date: "2026-10-28",
    title: "Reports",
    changes: [
      "New Reports tab (Directors and Finance; other roles can be given it in Admin → Roles), each with a date range, the same period last year and a Download CSV button for Excel.",
      "Sales and profit: sales, gross profit and margin by month, salesperson, business unit, sales account or customer. Money owed: issued unpaid invoices by customer in age bands (not yet due, 1–30, 31–60, 61–90, over 90 days).",
      "Customers: top customers with what they buy, new customers and those who've stopped buying. Magazine MI: booked against target and pages per edition and month, space sold by size, new advertisers and sales by salesperson.",
    ],
  },
  {
    version: "0.40.0",
    date: "2026-10-28",
    title: "FootprintAI and Transition in one place",
    changes: [
      "The menu now has one FootprintAI item instead of FootprintAI and Transition. It opens on This week, with tabs for All actions, Timeline and Agents & systems (the agents workspace), plus the two invite lists for directors and admins.",
      "Nobody sees more than before: people only on the transition don't get the agents workspace, and people only on the agents list don't get the transition.",
    ],
  },
  {
    version: "0.39.0",
    date: "2026-10-28",
    title: "Drag to reassign transition actions",
    changes: [
      "Transition → This week: drag an action onto someone's group to make them the owner. While dragging, a bar of everyone on the transition appears, so you can also drop it on someone with nothing due that week (or on “No owner”).",
      "Directors, admins and the invite list can do this (not board-only actions for the invite list). On a phone, change the owner in the action's side panel.",
    ],
  },
  {
    version: "0.38.0",
    date: "2026-10-28",
    title: "FootprintAI transition tracker",
    changes: [
      "New Transition section (admins, Directors, the invite list and action owners only) for the FootprintAI transition: four workstreams, eight Wednesday meetings to Christmas, gates and every action with its owner.",
      "This week: what's due at the next meeting plus anything overdue (in red), grouped by owner, with the status changed in place and a side panel for the detail, notes and updates. Arrows to look back or ahead.",
      "All actions: the full register by phase, with filters (stream, owner, status, week, Mine) that are remembered, and Add action. Timeline: swimlanes by stream with gates, the launch and the Christmas break.",
      "Board-only actions are hidden from everyone except admins and Directors by the database itself. Owners can change the status and notes of their own actions. “My transition actions” appears on your home page when you own open ones.",
    ],
  },
  {
    version: "0.37.0",
    date: "2026-10-27",
    title: "Flipbooks",
    changes: [
      "Magazines → an issue's flatplan → Digital edition: upload the finished PDF and it's online straight away as a public, page-turning flipbook (two-page spreads on a computer, one page on a phone, with a PDF download). Replaces Mag Manager's flipbook link.",
      "Each edition has a “latest issue” address (e.g. /read/fareham) that always shows the newest one, so a “Read online” button on the website never needs changing, plus copy-and-paste code to show it inside a page on forgetmenotonline.org or footprintgroup.uk.",
    ],
  },
  {
    version: "0.36.0",
    date: "2026-10-27",
    title: "Portal: adverts and invoices",
    changes: [
      "Customer portal: advertisers see their Forget Me Not adverts by month (edition, size, order) and how the artwork is getting on, in plain words.",
      "Customer portal: issued and paid invoices (never drafts), what's still to pay after any credit notes, overdue ones highlighted, and View / PDF for each.",
    ],
  },
  {
    version: "0.35.0",
    date: "2026-10-27",
    title: "Flatplans",
    changes: [
      "Magazines → Flatplan (link next to each edition on the dashboard): a page-by-page plan of each issue. Pages are colour-coded: empty, part full, full or over-full.",
      "Booked adverts waiting to be placed are listed down the side: drag one onto a page (or use “Put on page” on a phone). Move or take items off a page the same way.",
      "Add editorial (e.g. Editor's Letter) with a size, so it takes up space too. Each advert shows its artwork status.",
    ],
  },
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
