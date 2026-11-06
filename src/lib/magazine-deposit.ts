// Advert deposits (owner, 6 November 2026): Forget Me Not adverts have no
// contracts. As on the website calculator, if the first advert is 3 or more
// months away the customer can pay a 25% deposit when they confirm and the
// rest before the first print deadline; otherwise they pay in full.
// Kept apart from the database so it can be checked on its own.

export const DEPOSIT_PERCENT = 25;

// Calendar months from today's month to the first advert's month
// (any day in November 2026 → February 2027 = 3).
export function monthsAhead(today: string, firstMonth: string) {
  const [ty, tm] = today.split("-").map(Number);
  const [fy, fm] = firstMonth.split("-").map(Number);
  return (fy - ty) * 12 + (fm - tm);
}

export const depositAvailable = (today: string, firstMonth: string | null | undefined) =>
  !!firstMonth && monthsAhead(today, firstMonth) >= 3;

// The deposit and balance of a total including VAT, to the penny.
export function depositSplit(total: number) {
  const deposit = Math.round(total * DEPOSIT_PERCENT) / 100;
  return { deposit, balance: Math.round((total - deposit) * 100) / 100 };
}

// When the balance is due: the first advert month's earliest copy deadline,
// or the last day of the month before if no deadline is set.
export function balanceDueDate(firstMonth: string, copyDeadlines: (string | null)[]) {
  const set = copyDeadlines.filter((d): d is string => !!d).sort();
  if (set.length) return set[0];
  const d = new Date(`${firstMonth.slice(0, 7)}-01T12:00:00Z`);
  d.setUTCDate(0);
  return d.toISOString().slice(0, 10);
}
