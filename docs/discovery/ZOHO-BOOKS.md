# Zoho Books — what Footprint has today

_Gathered on 1 October 2026 from Zoho Books settings (no customer records, quotes or invoices were viewed). Zoho Books runs on Footprint's own address (business.footprintsouth.co.uk), EU data centre, organisation "Footprint South Copy and Design Ltd"._

## Document numbering (next numbers on 1 October 2026)

| Document | Prefix | Next number | Rough volume so far |
|---|---|---|---|
| Quote (Zoho "Estimate") | `QT-` | 009972 | ~10,000 |
| Sales order | `SO-` | 010913 | ~11,000 |
| Invoice | `INV-` | 074891 | ~75,000 |
| Purchase order | `PO-` | 03271 | ~3,300 |
| Credit note | `CN-` | 00009 | very few |

At cut-over the platform continues from Zoho's numbers so there are no gaps or clashes.

## VAT rates in use

20% (VAT on Income), 5%, Zero Rate, Zero Rated Income, Exempt Income, No VAT, Zero Rated EC Goods Income, Zero Rated EC Services. (Plus an oddly named "Zero Rate 20%" — to check with the owner.)

## Standard wording

- **Invoices:** notes give Footprint's bank details for payment; terms link to footprintsouth.co.uk/terms-and-conditions. _(Bank details are configured in the platform settings at cut-over, not stored in this document.)_
- **Sales orders:** same terms link.
- **Credit notes:** full credit note terms text.
- **Quotes:** no default notes/terms.

## Footprint's custom fields

**Quotes**
- Quote Stage _(required, multi-select)_: New Quote Raised, Sent to Customer For Approval, Amended, Awaiting Approval, Approved, Declined (+ two odd values: "Blank Email Sent", "SK JW Quote Details Save")
- Probability _(required)_: Low / Confident / Definite
- Business Unit _(required)_: Print / Account Sales / Digital
- Expected Order Date _(required)_: This Month / Next Month / Future
- Delivery Type _(required)_: Direct to Customer / Pick up from Footprint / Swindon Office / Footprint Delivery
- Reason for Loss: Price / Went Cold / Just Exploring / Requirements Not Met
- Labour Cost, Total GP (gross profit), Internal Customer Notes

**Sales orders**
- SOProcess _(required)_ — the production workflow: New Sales Order → With Design Team → Proof with Customer → Back With Matt → Sales Order Awaiting Update (several have "(No Email)" twins that suppress the customer email)
- Deadline Date, Business Unit, Expected Invoice Date, Internal Customer Notes _(required)_
- Copy Shop Job / Consumer Copy Shop Job (tick boxes), Time Spent on Copy Shop Job
- Total GP

**Invoices**: Total GP, Collected (tick box)

**Items (products)**: Supplier _(required)_: Cafe Menu Systems, Colour Graphics, Digiprint, Footprint, Footprint Design Service, Marqet Space, Metal Magnetic Badges, Pencarrie · Cost to Us · Total GP. Items also have sales rate, purchase rate, VAT, unit, SKU, sales and purchase accounts, and are linked to Zoho CRM Products.

## What this means for the platform

- **Gross profit matters**: every line needs a cost as well as a price, so GP can be shown on quotes, orders and invoices.
- The **SOProcess** steps are really the hand-off to the design/production team — they should link to Design Workload (Wave 4) later.
- Quote "stage" is partly replaced by **online approval**: the customer accepts or declines from a link, and the platform records it.
- The "(No Email)" variants show staff want control over **when customers are emailed** — the platform should never email a customer automatically without it being clear.
