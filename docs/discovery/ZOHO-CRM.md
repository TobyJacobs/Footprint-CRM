# Zoho CRM — what Footprint has today

_Gathered on 1 October 2026 from Zoho CRM's settings (field definitions only — no customer records were viewed). Zoho CRM is on the EU data centre (crm.zoho.eu)._

## Modules that matter for the new platform

| Zoho module | What it holds | New platform | Wave |
|---|---|---|---|
| **Accounts** | Customer companies | **Customers** | 1 |
| **Contacts** | People at those companies | **Contacts** (under each customer) | 1 |
| **Web Hosting Plans** (custom) | One hosting plan per customer, with price, billing frequency, status, plus sub-tables **Web Hosting Detail** (plan type, domain, included hours, 20i) and **Email Hosting** (mailboxes, platform) | **Hosting plans** on each customer | 1 |
| **Digital Retainers** (custom) | Monthly digital marketing retainers: fee, status (Live/Paused/Cancelled), Digital AM, Sales AM, budget hours, plus sub-table **Monthly Services** (Social content, Google/Meta/LinkedIn/TikTok Ads, email, blogs… with qty and ad spend) | **Retainers** on each customer | 1 |
| **Zoho Billing subscriptions** (`Subscriptions__s` + Plans & Addons) | Synced from **Zoho Billing**: status, amounts, billing interval, next billing date | Shown on each customer in Wave 1 (imported, read-only); **billing itself moves in Wave 2** | 1 → 2 |
| Notes | Notes against records | Customer timeline | 1 |
| Quotes, Sales Orders, Invoices, Purchase Orders (+ Zoho Finance copies), Products, Vendors | Quote-to-invoice | Quotes & Invoices | 2 |
| Leads, Deals (Opportunities), Upsell Opportunity, Campaigns | Sales pipeline & marketing | Later (Waves 3/8) | — |
| Xero Accounts (Xero extension) | Link to Xero contacts | Keep the **Xero ID** on each customer | 1 |

Integrations visible in the fields: **Xero** (Xero ID, Add to Xero, Xero Contact URL), **Zoho Billing**, **WorkflowMax** (`wfm_client…` fields), **Zoom webinars**, **SalesIQ** (web-visit fields), **Zoho Campaigns**.

## Accounts → Customers: fields in use (custom ones in **bold**)

- Identity: Account Name, Parent Account, Website, Phone, **Company Email**, Account Type (Business Customer, Prospect, Partner, Reseller, Distributor…), Ownership, Industry, Description, Account Owner
- Addresses: Billing and Shipping (street, city, province/county, postcode, country), **Google Address**
- Footprint status: **Contact and Account Status** (Client Active / Client Information Update Required / Client Not Active – Awaiting Deletion / No Current Services / Cancelled Services), **Active (Last 6 months)**, **Date last ordered**
- Services: **Service Stack** (Footprint Customer, Print, Digital, Signage, Web, Social, Advertising), tick-boxes **Print, Digital Marketing, Advertising, Signage, Merchandise, Vehicle Graphics, YLK**, **Products and Services Used**
- Finance: **Credit Status** (On stop / pay up front / Direct Debit / 7–60 day terms…), **Direct Debit Status – Print and Digital**, **Direct Debit Status FMN**, **Sales Discount %**, **Invoices Due Date (Day + Frequency)**, **Default Sales Account**, **Xero ID**, **Add to Xero**, **Xero Contact URL**
- Marketing / sales: **How did they hear about us**, **Marketing Brochures Sent**, **User Lead Alert**, **Account Score Card**, **Date Contacted**, **Follow Up**, **Call Notes**
- Legacy / integration (probably not needed): `contact_email`, `first_name`, `last_name`, `primary_domain`, `wfm_client*`, Territories, Enrich fields

## Contacts: fields in use

- Name: Salutation, First Name, Last Name; Title, Department; **Primary Contact**
- Contact details: Email, Secondary Email, Phone, Mobile, Home Phone; Mailing and Other addresses; **Google_Address**, **Address2**
- Link: Account Name (→ customer), Reporting To
- Marketing consent: **Email Opt Out**, **Include in Emails**, Unsubscribed Mode/Time, **Marketing Emails**, **Marketing Emails Available to Send**
- Status: **Financial Status** (Active / ON STOP), **Contact and Account Status**, **Not Active in the Last 6 Months**, **Lead Source FPG**, **Services Provided**, **Advertising customer**
- Probably not needed: Zoom webinar stats, SalesIQ visit stats, `wfm_contact*`, `lead_ad_prop0`, Source/Verified email (unused "Option 1/2" picklists)

## ⚠️ Security finding

**Web Hosting Plans stores "3rd Party Username" and "3rd Party Password" in plain text.** Passwords must not be copied into the new platform. Recommendation: move them into the new password manager (1Password/Bitwarden) during the Wave 0+ side track, and leave only a note like "Login in 1Password: *Client name – hosting*" on the hosting plan.
