import Link from "next/link";
import { Check, Minus, X } from "lucide-react";
import DesignJobsPanel from "@/components/DesignJobsPanel";
import { Badge, Card, inputClass, primaryButton, secondaryButton } from "@/components/ui";
import { gbp } from "@/lib/customers/display";
import { projectStatusLabel, projectTone } from "@/lib/projects/options";
import { poStatusLabel, statusToneFor } from "@/lib/sales/options";
import type { Stages } from "@/lib/sales/stages";

// The sales order page, in the owner's order (26 October 2026): a stage bar
// that lights up by itself, then Stage, Finance summary, Purchase orders,
// Design work, Project and Comms. Quotes and invoices keep their own layout.

export type OrderPo = { id: string; number: string; status: string; subtotal: number; supplier: string | null };
export type OrderProject = { id: string; number: string; name: string; status: string; tasksDone: number; tasksTotal: number };

// The stage bar for a quote or a sales order (stages from lib/sales/stages).
export function StageBar({ stages, states, cancelled, label = "Order stage" }: Stages & { cancelled?: boolean; label?: string }) {
  return (
    <div>
      {cancelled && <p className="mb-3 text-sm font-semibold text-fp-error">This order was cancelled.</p>}
      <ol aria-label={label} className={`grid gap-2 sm:grid-cols-3 ${stages.length > 4 ? "lg:grid-cols-6" : "lg:grid-cols-4"}`}>
        {stages.map((s, i) => {
          const state = states[i];
          return (
            <li
              key={s.label}
              aria-current={state === "current" ? "step" : undefined}
              className={`rounded-md border-2 p-3 text-sm ${
                state === "done"
                  ? "border-fp-teal-deep/30 bg-fp-teal/10"
                  : state === "current"
                    ? "border-fp-pink bg-fp-pink/5 shadow-sm"
                    : state === "stopped"
                      ? "border-fp-error/40 bg-fp-error/5 text-fp-error"
                      : "border-fp-border bg-white text-fp-mid"
              }`}
            >
              <span className="flex items-center gap-2 font-bold">
                <span
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] ${
                    state === "done"
                      ? "bg-fp-teal-deep text-white"
                      : state === "current"
                        ? "bg-fp-pink text-white"
                        : state === "stopped"
                          ? "bg-fp-error text-white"
                          : "border border-fp-border"
                  }`}
                >
                  {state === "done" ? (
                    <Check size={12} aria-hidden />
                  ) : state === "skipped" ? (
                    <Minus size={12} aria-hidden />
                  ) : state === "stopped" ? (
                    <X size={12} aria-hidden />
                  ) : (
                    i + 1
                  )}
                </span>
                {s.label}
              </span>
              <span className="mt-1 block text-xs">
                {state === "current" ? (
                  <>
                    <strong className="text-fp-pink">Now</strong>
                    {s.note ? ` · ${s.note}` : ""}
                  </>
                ) : state === "stopped" ? (
                  s.note ?? "Stopped"
                ) : state === "skipped" ? (
                  "Not needed"
                ) : (
                  s.note ?? (state === "done" ? "Done" : "")
                )}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

// Finance summary: simple bars, each drawn against the biggest figure.
export function FinanceSummary({
  net,
  cost,
  labour,
  poSubtotal,
  total,
  invoiced,
  invoicedNet,
}: {
  net: number;
  cost: number;
  labour: number | null;
  poSubtotal: number;
  total: number;
  invoiced: number;
  // Before VAT, for "still to invoice".
  invoicedNet: number;
}) {
  const margin = net - cost - (labour ?? 0);
  const scale = Math.max(net, cost + (labour ?? 0), poSubtotal, 1);
  const share = (v: number) => (net ? `${Math.round((v / net) * 100)}%` : "");
  const bars: { label: string; value: number; note: string; colour: string }[] = [
    { label: "Order value (before VAT)", value: net, note: "", colour: "bg-fp-black" },
    { label: "Cost of the job", value: cost, note: share(cost), colour: "bg-fp-amber" },
    ...(labour !== null ? [{ label: "Labour", value: labour, note: share(labour), colour: "bg-fp-amber/60" }] : []),
    { label: labour !== null ? "Margin after labour" : "Margin", value: margin, note: share(margin), colour: margin < 0 ? "bg-fp-error" : "bg-fp-teal-deep" },
    {
      label: "Ordered from suppliers (POs, before VAT)",
      value: poSubtotal,
      note: cost ? `${Math.round((poSubtotal / cost) * 100)}% of the cost` : "",
      colour: "bg-fp-pink",
    },
  ];
  return (
    <div className="grid gap-5 lg:grid-cols-[2fr_1fr]">
      <ul className="grid gap-3 text-sm">
        {bars.map((b) => (
          <li key={b.label}>
            <div className="mb-1 flex justify-between gap-3">
              <span>{b.label}</span>
              <span className="font-semibold">
                {gbp(b.value)}
                {b.note && <span className="ml-2 text-xs font-normal text-fp-mid">{b.note}</span>}
              </span>
            </div>
            <div className="h-3 rounded-full bg-fp-light" aria-hidden>
              <div className={`h-3 rounded-full ${b.colour}`} style={{ width: `${Math.max(0, Math.min(100, (Math.abs(b.value) / scale) * 100))}%` }} />
            </div>
          </li>
        ))}
      </ul>
      <div className="grid content-start gap-3 rounded-md bg-fp-offwhite p-4 text-sm">
        <p className="text-xs font-bold uppercase tracking-wide text-fp-mid">Invoiced</p>
        <p className="text-2xl font-black">
          {gbp(invoiced)} <span className="text-sm font-semibold text-fp-mid">of {gbp(total)}</span>
        </p>
        <div className="h-3 rounded-full bg-white" aria-hidden>
          <div className="h-3 rounded-full bg-fp-teal-deep" style={{ width: `${total ? Math.min(100, (invoiced / total) * 100) : 0}%` }} />
        </div>
        <p className="text-sm">
          <strong>Still to invoice:</strong> {gbp(Math.max(0, net - invoicedNet))} <span className="text-fp-mid">before VAT</span>
        </p>
        <p className="text-xs text-fp-mid">Invoiced figures include VAT. Staff only — customers never see cost or margin.</p>
      </div>
    </div>
  );
}

export function PurchaseOrdersSection({ pos, raise }: { pos: OrderPo[]; raise: React.ReactNode }) {
  return (
    <Card title={`Purchase orders${pos.length ? ` (${pos.length})` : ""}`} action={raise}>
      {pos.length === 0 ? (
        <p className="text-sm text-fp-mid">Nothing ordered from suppliers yet.</p>
      ) : (
        <ul className="grid gap-2 text-sm">
          {pos.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center justify-between gap-2">
              <Link href={`/sales/purchase-orders/${p.id}`} className="font-semibold text-fp-teal-deep hover:underline">
                {p.number}
              </Link>
              <span className="text-fp-dark/75">{p.supplier}</span>
              <span>{gbp(p.subtotal)}</span>
              <Badge tone={statusToneFor(p.status)}>{poStatusLabel(p.status)}</Badge>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

export function ProjectSection({ project, create, canView }: { project: OrderProject | null; create: React.ReactNode; canView: boolean }) {
  if (!project) {
    return (
      <Card title="Project">
        <div className="grid gap-3 text-sm">
          <p className="text-fp-mid">No project yet.</p>
          {create}
        </div>
      </Card>
    );
  }
  const name = `${project.number} · ${project.name}`;
  return (
    <Card title="Project">
      <div className="grid gap-3 text-sm">
        <p>
          {canView ? (
            <Link href={`/projects/${project.id}`} className="font-semibold text-fp-teal-deep hover:underline">
              {name}
            </Link>
          ) : (
            <strong>{name}</strong>
          )}
        </p>
        <p className="flex items-center gap-2">
          <Badge tone={projectTone(project.status)}>{projectStatusLabel(project.status)}</Badge>
          {project.tasksTotal > 0 && <span className="text-fp-dark/75">{project.tasksDone} of {project.tasksTotal} tasks done</span>}
        </p>
        {project.tasksTotal > 0 && (
          <div className="h-2 rounded-full bg-fp-light" aria-hidden>
            <div className="h-2 rounded-full bg-fp-teal-deep" style={{ width: `${(project.tasksDone / project.tasksTotal) * 100}%` }} />
          </div>
        )}
        {canView && (
          <Link href={`/projects/${project.id}`} className={`${secondaryButton} justify-self-start`}>
            Open project
          </Link>
        )}
      </div>
    </Card>
  );
}

// Design work: the existing Design jobs card (hidden from people without Design access).
export function DesignSection({ orderId }: { orderId: string }) {
  return <DesignJobsPanel order={orderId} />;
}

// Part billing (owner, 26 October 2026): bill part of the order as a £ amount
// before VAT or a percentage, or bill whatever is left.
export function PartInvoiceForm({
  orderNet,
  invoicedNet,
  partAction,
}: {
  orderNet: number;
  invoicedNet: number;
  partAction: (fd: FormData) => Promise<void>;
}) {
  const remaining = Math.round((orderNet - invoicedNet) * 100) / 100;
  if (remaining <= 0) return null;
  return (
    <div className="mt-4 grid gap-3 rounded-md border border-fp-border p-4 text-sm">
      {invoicedNet > 0 && (
        <p>
          Invoiced so far <strong>{gbp(invoicedNet)}</strong> of {gbp(orderNet)} before VAT · <strong>{gbp(remaining)}</strong> still to invoice.
        </p>
      )}
      <form action={partAction} className="flex flex-wrap items-end gap-2">
        <label className="grid gap-1">
          <span className="font-semibold">Part invoice</span>
          <input name="amount" type="number" step="any" min="0" required placeholder="e.g. 1000 or 50" className={`${inputClass} w-40`} />
        </label>
        <select name="unit" aria-label="Pounds or percent" defaultValue="gbp" className={`${inputClass} w-auto`}>
          <option value="gbp">£ before VAT</option>
          <option value="percent">% of the order</option>
        </select>
        <button type="submit" className={secondaryButton}>
          Create part invoice
        </button>
      </form>
      {invoicedNet > 0 && (
        <form action={partAction}>
          <input type="hidden" name="rest" value="1" />
          <button type="submit" className={primaryButton}>
            Invoice the rest ({gbp(remaining)} + VAT)
          </button>
        </form>
      )}
    </div>
  );
}
