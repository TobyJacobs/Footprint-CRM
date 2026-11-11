// Choices for customer fields, worded exactly as in Zoho CRM so imported
// records match (account types and "heard about us" copied from Zoho on
// 5 October 2026). Add new options here — no database change needed.

export const customerStatuses = ["Active", "Cancelled"];

export const accountTypes = [
  "Business Customer",
  "Key Account",
  "Managed Account",
  "Pool Customer",
  "Prospect",
  "Acquisition Target",
  "Acquisition - Contacted",
  "Partner",
  "Reseller",
  "Distributor",
  "Integrator",
  "Supplier",
  "Vendor",
  "Investor",
  "Analyst",
  "Competitor",
  "Press",
  "ON STOP - NO ORDERS TO BE PROCESSED",
  "Imported",
  "Other",
];

export const ownershipTypes = ["Private", "Public", "Subsidiary", "Charity", "Other"];

// Merges Zoho's "Service Stack" list and its service tick-boxes.
export const services = [
  "Print",
  "Digital Marketing",
  "Web",
  "Social",
  "Advertising",
  "Signage",
  "Vehicle Graphics",
  "Merchandise",
  "YLK",
];

// Credit status wording (DJ, 11 November 2026): "Net 7" etc. instead of
// "7 Day Terms Available to Client", "Upfront payment" instead of the two
// pay-first options, and no Direct Debit option (it has its own field).
export const creditStatuses = [
  "ON STOP contact OPS/Finance Team",
  "Upfront payment",
  "Net 7",
  "Net 14",
  "Net 30",
  "Net 60",
  "See notes for more info",
];

// The invoice due terms a credit status implies (DJ, 11 November 2026): the
// customer form fills them in when the credit status is picked. Net N → N
// days after the bill date; Upfront payment → due on the bill date. Other
// statuses (on stop, see notes) leave the terms as they are.
export function dueTermsForCreditStatus(status: string | null | undefined): { days: number; terms: string } | null {
  if (!status) return null;
  const net = /^Net (\d+)$/.exec(status);
  if (net) return { days: Number(net[1]), terms: "day(s) after bill date" };
  if (status === "Upfront payment") return { days: 0, terms: "day(s) after bill date" };
  return null;
}

// Credit statuses that warn staff before they quote or order: on stop, or
// pay first (including the old Zoho wording).
export const isCreditWarning = (status: string | null | undefined): status is string =>
  !!status && /ON STOP|Up ?front|before we order/i.test(status);

export const directDebitStatuses = [
  "Not Signed Up",
  "Active",
  "Cancelled",
  "FMN Active",
  "See notes for more info",
];

export const invoiceDueTerms = [
  "day(s) after bill date",
  "day(s) after bill month",
  "of the current month",
  "of the following month",
];

export const heardAboutUs = [
  "Cold Contact - Sourced Business",
  "Event",
  "Existing Client - C3",
  "Existing Client - FMN",
  "Existing Client - Footprint",
  "Existing Client - Freedom",
  "FMN Client",
  "Paid Ad",
  "Referral",
  "Social",
  "Walk in",
  "Website Enquiry",
  "Your Lead Kit",
];

export const brochures = ["Footprint Group", "Print", "Signage", "Digital Marketing", "Advertising"];

export const salutations = ["Mr.", "Mrs.", "Ms.", "Miss", "Dr.", "Prof."];

export const contactFinancialStatuses = ["Active", "ON STOP"];

export const leadSources = [
  "Existing Account",
  "Footprint Group (Multiple Services )",
  "FMN Customer",
  "Marketing Campaign",
  "Paid Ad",
  "Online Store",
  "Chat",
  "Website form",
  "Cold Call",
  "Cold Contact",
  "Employee Referral",
  "Partner",
];

export const marketingLists = ["Welcome", "Special Offers", "Introduction to Footprint", "View Our Latest Offers"];

// Hosting
export const hostingStatuses = ["Active", "Cancelled"];
export const hostingPlanTypes = [
  "Monthly Business Pro Plan",
  "Annual Business Pro Plan",
  "Business Pro Plus",
  "Legacy Business Pro Plan",
  "Annual Web and Domain Hosting",
  "Annual Web Hosting Plans",
  "Annual Domain Hosting",
  "Annual Website Software Renewal",
  "Additional 10G Mailbox",
];
export const billingFrequencies = ["Monthly", "Quarterly", "6 Monthly", "Annually", "Bi Annual"];
export const renewalMonths = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
export const webHostingPlans = [
  "Hosting - Standard",
  "Hosting - Business Pro",
  "Hosting - Business Pro+",
  "Domain Renewal",
  "Premium Plug-In Renewal",
];
export const includedHours = ["1 Hour", "2 Hours", "3 Hours", "4 Hours", "Unlimited"];
export const emailPlatforms = ["20i", "Office 365", "Google", "Other"];

// Retainers
export const retainerStatuses = ["Live", "Paused", "Cancelled"];
export const retainerServices = [
  "Social Media Content",
  "Google Ads",
  "Meta Ads",
  "LinkedIn Ads",
  "TikTok Ads",
  "Email Marketing",
  "Blog Posts",
  "Case Studies",
  "Strategy/PM",
];

export const activityKinds = [
  { value: "note", label: "Note" },
  { value: "call", label: "Call" },
  { value: "email", label: "Email" },
  { value: "meeting", label: "Meeting" },
] as const;

// How a timeline entry's kind is shown. "system" entries are written
// automatically (orders from accepted quotes, recurring invoices…).
export const activityLabel = (kind: string) =>
  kind === "system" ? "Automatic" : (activityKinds.find((k) => k.value === kind)?.label ?? kind);
