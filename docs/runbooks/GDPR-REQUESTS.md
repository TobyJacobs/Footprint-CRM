# Handling data protection requests (UK GDPR) — runbook

_For admins. Written 1 October 2026. Follow Footprint's own GDPR policy and check with the Data Protection Officer if unsure._

## Subject access request ("what data do you hold about me?")

1. **Check who's asking.** Confirm the person is who they say they are (e.g. reply to the email address we already hold, or ask for ID). Don't send data to an unverified address.
2. Note the date the request arrived. **You have one month to respond.**
3. In the platform, open the person: **Customers → the customer → Contacts → Edit** on the person.
   For a sole trader whose business *is* the person, use the customer's **Edit** page instead.
4. In **Data protection (UK GDPR)**, click **Download data (JSON file)**. This includes their details, timeline entries and change history.
5. Check the file doesn't include anyone *else's* personal data (e.g. notes mentioning other people) and remove it if it does.
6. Send it securely (e.g. a password-protected file, with the password sent separately).
7. Other systems not yet replaced (Zoho, Mag Manager, GoHighLevel, Xero) must be checked separately until they're switched off.

The export is recorded in **Admin → Audit log** as "GDPR data export".

## Erasure request ("delete my data")

1. Check who's asking (as above) and whether we have a reason we **must** keep some data — e.g. invoices must be kept for 6 years for HMRC. Erasure in the platform does not touch legally-required records.
2. Open the person (or the customer, for a sole trader) → **Edit** → **Data protection** → **Erase**.
3. Confirm. The person's name and contact details are blanked, they're removed from mailing lists, timeline entries about them are deleted (unless you untick that), and their details are cleaned out of the audit log. The record stays as "Removed (GDPR)".
4. **Also remove them from Zoho** (and any other old system still in use), otherwise the data still exists there. The platform's Zoho import will never bring an erased person back.
5. Reply to the person confirming it's done, within one month.

The erasure is recorded in **Admin → Audit log** as "GDPR erasure" (who and when — not what was removed).

## Marketing opt-outs

If someone just doesn't want marketing, don't erase them — tick **Opted out of marketing emails** on their contact. That always overrides "Include in marketing emails".
