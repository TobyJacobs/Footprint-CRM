// Proposals, laid out like Footprint's quote builder (quotes.footprintgroup.uk;
// DJ, 9 November 2026). Each line is one-off, monthly or included. One-off
// costs can be spread over 3, 6 or 9 months at 0%, with a 25% or 50% deposit
// on acceptance; monthly costs are billed separately from activation.
// Kept apart from the database so it can be checked on its own.

export type Billing = "oneoff" | "monthly" | "included";
export const billingOptions: { value: Billing; label: string }[] = [
  { value: "oneoff", label: "One-off" },
  { value: "monthly", label: "Monthly" },
  { value: "included", label: "Included" },
];
export const isBilling = (v: unknown): v is Billing => v === "oneoff" || v === "monthly" || v === "included";
export const billingLabel = (v: unknown) => billingOptions.find((b) => b.value === v)?.label ?? "One-off";

export const planOptions: { value: number | null; label: string; note: string }[] = [
  { value: null, label: "Pay in full", note: "Full amount up front" },
  { value: 3, label: "3 months", note: "0% instalments" },
  { value: 6, label: "6 months", note: "0% instalments" },
  { value: 9, label: "9 months", note: "0% instalments" },
];
export const depositOptions: { value: number; label: string; note: string }[] = [
  { value: 0, label: "No deposit", note: "Standard terms" },
  { value: 25, label: "25% deposit", note: "On acceptance" },
  { value: 50, label: "50% deposit", note: "On acceptance" },
];
export const isPlanMonths = (v: unknown): v is 3 | 6 | 9 => v === 3 || v === 6 || v === 9;
export const isDepositPercent = (v: unknown): v is 0 | 25 | 50 => v === 0 || v === 25 || v === 50;

// Footprint's standard proposal terms (from the quote builder), editable per proposal.
export const defaultProposalTerms = `1. This quotation is valid for 30 days from the date issued unless otherwise stated.
2. All prices are shown exclusive of VAT, which is charged at the prevailing rate.
3. A deposit or first instalment may be required before work commences; full payment terms will be confirmed on order.
4. One-off project costs may be split into instalments as selected on this quote; ongoing subscription/monthly costs are billed separately and continue until cancelled with notice.
5. Ownership of final artwork, website files and deliverables transfers to the client upon receipt of payment in full.
6. Any changes to the agreed scope of work may be subject to additional charges, to be agreed in writing before proceeding.
7. Cancellation of ongoing services requires 30 days' written notice.
8. This quotation does not constitute a contract. A formal agreement will be issued upon acceptance.`;

const round2 = (n: number) => Math.round(n * 100) / 100;

type LineLike = { billing?: string | null; line_net: number; tax_rate: number };

// One-off and monthly totals (before VAT, VAT, with VAT). Included lines cost nothing.
export function proposalTotals(lines: LineLike[]) {
  const sum = (b: Billing) => {
    const ls = lines.filter((l) => (l.billing ?? "oneoff") === b);
    const net = round2(ls.reduce((s, l) => s + Number(l.line_net), 0));
    const vat = round2(ls.reduce((s, l) => s + (Number(l.line_net) * Number(l.tax_rate)) / 100, 0));
    return { net, vat, total: round2(net + vat) };
  };
  return { oneOff: sum("oneoff"), monthly: sum("monthly") };
}

export type ScheduleRow = { label: string; due: string; amount: number; kind: "deposit" | "instalment" | "balance" | "full" | "subscription" };

// The payment schedule the customer sees. Instalments share out the pence so
// they add up exactly to the one-off total.
export function paymentSchedule(oneOffTotal: number, monthlyTotal: number, planMonths: number | null, depositPercent: number) {
  const rows: ScheduleRow[] = [];
  if (oneOffTotal > 0) {
    const deposit = depositPercent > 0 ? round2((oneOffTotal * depositPercent) / 100) : 0;
    const rest = round2(oneOffTotal - deposit);
    if (deposit > 0) rows.push({ label: `Deposit (${depositPercent}%)`, due: "On acceptance", amount: deposit, kind: "deposit" });
    if (!planMonths) {
      rows.push(
        deposit > 0
          ? { label: "Balance", due: "On completion", amount: rest, kind: "balance" }
          : { label: "Full payment", due: "On acceptance", amount: oneOffTotal, kind: "full" },
      );
    } else {
      const each = Math.floor((rest / planMonths) * 100) / 100;
      for (let i = 1; i <= planMonths; i++) {
        const amount = i === planMonths ? round2(rest - each * (planMonths - 1)) : each;
        rows.push({ label: `Instalment ${i} of ${planMonths}`, due: `Month ${i}`, amount, kind: "instalment" });
      }
    }
  }
  if (monthlyTotal > 0) rows.push({ label: "Ongoing subscription", due: "From activation, monthly", amount: monthlyTotal, kind: "subscription" });
  return rows;
}

export function scheduleTitle(oneOffTotal: number, planMonths: number | null, depositPercent: number) {
  if (oneOffTotal <= 0) return "Payment schedule";
  return `Payment schedule: ${depositPercent > 0 ? `${depositPercent}% deposit + ` : ""}${planMonths ? `${planMonths} monthly instalments` : depositPercent > 0 ? "balance on completion" : "full payment"}`;
}

// "Next steps" wording, as on the quote builder.
export function paymentNextSteps(oneOff: number, monthly: number, depositPercent: number) {
  const parts: string[] = [];
  if (oneOff > 0) parts.push(`One-off project costs${depositPercent > 0 ? " (deposit and balance)" : ""} are paid securely online.`);
  if (monthly > 0) parts.push("Ongoing monthly subscriptions are collected by Direct Debit (GoCardless).");
  return parts.join(" ");
}
