# Wave 5 (Magazines): what Mag Manager does for Footprint

_Written 27 October 2026 after Claude looked through Mag Manager (read only) with Toby and the director. Nothing in Mag Manager was changed. No customer names or details are recorded here._

Each feature is marked **Keep** (must be in FootprintOS before Mag Manager is switched off), **Later** (nice to have) or **?** (to confirm with the director).

## 1. Publications (editions) and issues
- **11 Forget Me Not editions**, lettered A to K: A. Gosport, B. Stubbington & Lee-on-the-Solent, C. Portchester & Drayton, D. Fareham, E. Locks Heath and Whiteley, F. Warsash & Hamble, G. Hedge End, H. West End & Boorley Green, I. Chandler's Ford, J. Fair Oak & Boyatt Wood, K. Meon Valley.
- Two extra "publications" used for other sales: **Leaflet Distribution out of Area** and **Miscellaneous**. (Mag Manager lists 17 publications in total; some are switched off.)
- Each edition has: monthly interval, format (A5), distribution figure (e.g. Fareham 10,000, door to door), a **monthly sales target** (e.g. Fareham £19,000), a Xero account code (4003 Magazine Advertising), and a master page layout. **Keep**
- **Monthly issues** per edition (history back to February 2015), each with a copy deadline, target, page count, themes and a "complete" switch. **Keep**
- Online **flipbook** settings per edition (digital page-turning version). **?**

## 2. Dashboard
- For the current issue, per edition: pages, pages of adverts / client content / other content / still available (with %), sales target achieved (£ and %), revenue per page and total booked. Charts of revenue and pages per edition. **Keep**
- New / existing / returning / renewal / not booked advertiser counts per edition. **Keep**
- **Today's bookings** list: company, salesperson, time, type (new booking, update, new misc booking, brand new booking), amount. **Keep**

## 3. Advert sizes (content types)
Set once for all editions, with sizes in mm. Switched on today: Eighth Page (60×45), Quarter Page Portrait (60×90), Quarter Page Landscape (130×45), Third Page Landscape (130×60), Sixth Page Portrait (63×60), Half Page Landscape (130×90), Half Page Portrait (60×190), Two Third Page (130×125), Three Quarter Page (130×140), Full Page (130×190), Double Page Spread (297×210), Small Ad (40×45), FMN small ad ×2 (85×45). Others exist but are switched off. **Keep**
- No default prices are set: **prices are entered on each booking**. **?** (confirm whether there's a rate card)

## 4. Bookings
- Every booking: company, section (business category), salesperson, date booked, edition, issue, advert type, amount, invoiced yes/no, flags. About 900 bookings in the November 2026 issue across all editions. **Keep**
- Booking history tab. **Keep**
- Series bookings (the same advert in future issues) and "future bookings" are used by renewals. **Keep**
- Miscellaneous bookings (non-advert sales). **Keep**

## 5. Sales calendar
- Calendar (month / week / day / list) of sales per salesperson. **Later**

## 6. Renewals
- For each issue, a list of advertisers who booked before but not in this issue, with a **renewal score** (e.g. "booked in last issue, not this one, no future bookings" = 20), reason, salesperson and the £ opportunity. Tabs per salesperson, "Carried Forward" and "Definitely Out". About 245 renewals for November 2026 (£44,833 opportunity). **Keep**
- The score rules can be reordered in settings. **Keep**

## 7. Actions (follow-ups)
- Tasks per company: due date, type (e.g. phone), reason, description, outcome, salesperson, priority, complete. Calendar view. About 2,050 outstanding. **Keep** (FootprintOS already has customer follow-ups; join them up)

## 8. Artwork and production
- **All artwork** list per issue: company, type (advert / content), size, salesperson, status, due date. Colour-coded statuses: Customer Artwork Approved, Previous Month (re-run), Awaiting Customer Approval, Passed To Production, Action Required. **Keep**
- **Production** list: company, contact, value, size, designer, status, artwork file, last note, due date, complete. **Keep** (link to the Design Workload and online proof approval we already have)

## 9. Flatplans
- Per edition and issue: an **overview grid of every page**, colour-coded by how full it is. **Keep**
- A **visual flatplan**: each page shows the adverts placed on it (advertiser and artwork status) and editorial (e.g. Editor's Letter, articles). Unplaced adverts are listed by size on the left for placing. Lock, move and swap pages. **Keep**
- Add/remove pages, page layouts (grids such as 16-grid, 6-grid, 12 & 18-grid, front page, inside covers, small-ad page), master pages. **Keep**
- Auto-place adverts and auto-publish options. **?**
- Flatplan notes, advertisers index and content index per issue. **Keep**

## 10. Articles (editorial library)
- A library of ready-made editorial (features, puzzles, recipes) by style, collection (month) and size, to drop into issues. Probably supplied by Mag Manager. **?** (do we use it, and could we replace it?)

## 11. Invoicing
- Invoicing goes **straight to Xero** (the Invoicing page opens Xero's sign-in). Each edition has a Xero account code. **Keep** (Xero sync is in the Go-live stage)
- Stripe and GoCardless connections exist in settings. **?** (are they used?)

## 12. Reports
About 60 reports. The groups: artwork statuses; bookings (by issue, user, category, section, renewals, single customer, historical by advert type, premium positions, not ongoing, top categories); complimentary and voucher copies; customers (all companies and contacts, notes, actions, Mailchimp mailshot export); **financial** (aged debt, **commission reports**, Direct Debit list, invoice report, VAT cash accounting); advertiser and content **indexes** for printing; **labels** for voucher and complimentary copies. **?** (which ones are actually used)

## 13. Settings worth noting
- Users, **portal users** (Mag Manager has its own customer portal), document templates, national advertising, provisional percentages, booking weighting, **pipelines** (kanban), company and person flags, lead sources, contact types / reasons / outcomes, custom tabs, Dropbox, email logs, customer import. **?**

## Answers from Toby and the director (27 October 2026)
1. **Rate card:** yes, there is one. _(Send Claude a copy: sizes, prices and any multi-issue or multi-edition discounts.)_
2. **Commission:** set per salesperson. _(Rules to be confirmed.)_
3. **Timetable:** yes, there's a monthly timetable. _(Send Claude a copy: booking deadline, artwork deadline, print and delivery dates.)_
4. **Reach:** around **50,000 homes a month** across all editions.
5. **Reports:** not many are used. _(Priorities to be confirmed.)_
6. Other features in use:
   - **Articles library:** used, but we accept we may need another source.
   - **Flipbooks:** used; they're published on our website. **Keep**
   - **Mag Manager's customer portal:** used. Bring it into the FootprintOS customer portal. **Keep**
   - **Pipelines:** used. Bring into FootprintOS (we already have a sales pipeline). **Keep**
   - **Stripe and GoCardless:** both used. **Keep**
7. **What's wrong with Mag Manager** (what FootprintOS should fix):
   - No connection (API) to our other systems.
   - Can't sell directly from our website with **live advert availability**.
   - Two separate databases, so poor management information (**MI**).
   - No **contract management** for long-term bookings: agreed verbally or by email, not tied to terms.
8. **Contract:** Mag Manager is monthly rolling. **Safest switch-over month: January** (year to confirm).

## What this means for FootprintOS (Claude's summary)
- Magazines must live **inside FootprintOS**, using the same customers, sales orders, invoices and Xero link, so there's one database and proper MI.
- New things Mag Manager can't do: **contracts for long-term bookings** (tied to terms and conditions, accepted online like quotes), and **online booking from the website with live availability** (Wave 6).
- Must keep: editions and issues, rate card, bookings, renewals, actions, artwork and production, flatplans, flipbooks on the website, commission per salesperson, the reports actually used, Stripe and GoCardless payments.

## Still needed from the business
- The **rate card** and the **monthly timetable** (a PDF or photo is fine).
- **Commission** rules per salesperson.
- The **reports** you rely on each month.
- Which **year's January** to switch over in.
