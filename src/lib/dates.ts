// Dates in UK time.
//
// The server runs on UTC, so working out "today" from the server clock gives
// yesterday's date between midnight and 1am in British Summer Time. Everything
// that needs today's date (issue dates, due dates, "this month") uses these.
// Dates are passed around as plain "2026-10-19" text, so once worked out they
// never shift with time zones.

const ukDateFormat = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/London",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

// Today's date in the UK, e.g. "2026-10-19" (or the UK date of another moment).
export const ukToday = (at: Date = new Date()) => ukDateFormat.format(at);

// This month in the UK, e.g. "2026-10".
export const ukMonth = (at?: Date) => ukToday(at).slice(0, 7);

// A plain date moved by a number of days: addDaysTo("2026-10-30", 3) = "2026-11-02".
export function addDaysTo(date: string, days: number) {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// A month moved by a number of months: addMonthsTo("2026-01", -1) = "2025-12".
export function addMonthsTo(month: string, months: number) {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1 + months, 1)).toISOString().slice(0, 7);
}

// The UK date a number of days from today.
export const ukDaysFromToday = (days: number) => addDaysTo(ukToday(), days);

// When an invoice is due, using a customer's own payment terms (copied from
// Zoho: a number of days plus one of the "invoiceDueTerms" wordings). Returns
// null when the customer has no terms of their own, so the company's standard
// terms are used instead.
export function customerDueDate(issueDate: string, days: number | null | undefined, terms: string | null | undefined) {
  if (days === null || days === undefined || !Number.isFinite(days) || days < 0) return null;
  const month = issueDate.slice(0, 7);
  const lastDay = (m: string) => addDaysTo(`${addMonthsTo(m, 1)}-01`, -1);
  const dayOf = (m: string) => {
    const last = lastDay(m);
    return `${m}-${String(Math.min(Math.max(days, 1), Number(last.slice(8, 10)))).padStart(2, "0")}`;
  };
  switch (terms) {
    case "day(s) after bill month":
      return addDaysTo(lastDay(month), days);
    case "of the current month":
      return dayOf(month);
    case "of the following month":
      return dayOf(addMonthsTo(month, 1));
    default: // "day(s) after bill date", or no wording given
      return addDaysTo(issueDate, days);
  }
}
