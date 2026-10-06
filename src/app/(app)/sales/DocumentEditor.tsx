"use client";

import { useRef, useState, useTransition } from "react";
import { Plus, Trash2, UserPlus } from "lucide-react";
import { inputClass, primaryButton, secondaryButton } from "@/components/ui";
import { quickAddCustomer, type QuickCustomerInput } from "../customers/actions";
import { DuplicateCheck } from "../customers/DuplicateCheck";
import ProductDropdown, { productLineText } from "./ProductDropdown";
import { totals, lineNet, marginPercent } from "@/lib/sales/options";

type TaxRate = { id: string; name: string; rate: number };
type Contact = { id: string; first_name: string | null; last_name: string; email: string | null; is_primary: boolean };
type CustomerHit = { id: string; name: string; billing_city: string | null; credit_status: string | null; has_duplicate?: boolean };
export type ProductHit = {
  id: string;
  name: string;
  sku: string | null;
  description: string | null;
  unit: string | null;
  sale_price: number;
  cost_price: number | null;
  tax_rate_id: string | null;
  tax_rate: number;
};

export type EditorLine = {
  key: string;
  product_id: string | null;
  description: string;
  quantity: number;
  unit_price: number;
  unit_cost: number | null;
  discount_percent: number;
  tax_rate_id: string | null;
  tax_rate: number;
  gp_override?: number | null;
};

const money = new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" });
let keyCounter = 0;
const newKey = () => `l${Date.now()}-${keyCounter++}`;

function blankLine(defaultTax: TaxRate | undefined): EditorLine {
  return {
    key: newKey(),
    product_id: null,
    description: "",
    quantity: 1,
    unit_price: 0,
    unit_cost: null,
    discount_percent: 0,
    tax_rate_id: defaultTax?.id ?? null,
    tax_rate: defaultTax?.rate ?? 0,
  };
}

function num(v: string) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

// Small "search as you type" box used for customers and products.
function useSearch<T>(url: string) {
  const [results, setResults] = useState<T[]>([]);
  // The text the current results are for (null = nothing to show).
  const [searched, setSearched] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const search = (q: string) => {
    if (timer.current) clearTimeout(timer.current);
    if (q.trim().length < 2) {
      setResults([]);
      setSearched(null);
      return;
    }
    timer.current = setTimeout(async () => {
      const res = await fetch(`${url}?q=${encodeURIComponent(q.trim())}`);
      setResults(res.ok ? await res.json() : []);
      setSearched(q.trim());
    }, 250);
  };
  const clear = () => {
    setResults([]);
    setSearched(null);
  };
  return { results, searched, search, clear };
}

// Small form to add a customer (and its main contact) without leaving the
// quote. Not a <form>: it sits inside the quote's own form.
function QuickAddCustomer({
  initialName,
  onAdded,
  onUseExisting,
  onCancel,
}: {
  initialName: string;
  onAdded: (customer: CustomerHit, contact: Contact | null) => void;
  onUseExisting: (customer: CustomerHit) => void;
  onCancel: () => void;
}) {
  const [v, setV] = useState<QuickCustomerInput>({ name: initialName });
  const [error, setError] = useState<string | null>(null);
  const [existing, setExisting] = useState<CustomerHit | null>(null);
  const [pending, startTransition] = useTransition();

  const save = (allowDuplicate = false) =>
    startTransition(async () => {
      setError(null);
      const result = await quickAddCustomer({ ...v, allowDuplicate });
      if (result.ok) onAdded(result.customer, result.contact);
      else {
        setError(result.error);
        setExisting(result.existing ?? null);
      }
    });

  const field = (label: string, k: keyof QuickCustomerInput, type = "text", placeholder?: string) => (
    <label className="grid gap-1 text-sm">
      <span className="font-semibold">{label}</span>
      <input
        type={type}
        value={(v[k] as string | undefined) ?? ""}
        onChange={(e) => setV((old) => ({ ...old, [k]: e.target.value }))}
        placeholder={placeholder}
        className={inputClass}
        autoComplete="off"
        onKeyDown={(e) => {
          // Enter would submit the whole quote; save the customer instead.
          if (e.key === "Enter") {
            e.preventDefault();
            save();
          }
        }}
      />
    </label>
  );

  return (
    <div className="rounded-lg border border-fp-teal-deep/40 bg-fp-teal/5 p-4 sm:col-span-2">
      <p className="mb-3 flex items-center gap-2 font-bold">
        <UserPlus size={16} className="text-fp-teal-deep" aria-hidden /> New customer
      </p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="sm:col-span-2">{field("Company name", "name")}</div>
        {field("Phone", "phone", "tel")}
        {field("Postcode", "postcode")}
        <div className="sm:col-span-2">{field("Company email", "email", "email", "accounts@company.co.uk")}</div>
      </div>
      <DuplicateCheck
        name={v.name ?? ""}
        phone={v.phone}
        email={v.email}
        selectLabel="Use this customer"
        onSelect={(c) => onUseExisting({ id: c.id, name: c.name, billing_city: c.billing_city, credit_status: null })}
      />
      <p className="mb-2 mt-4 text-sm font-semibold">Main contact (optional)</p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {field("First name", "contactFirstName")}
        {field("Last name", "contactLastName")}
        {field("Email", "contactEmail", "email")}
        {field("Phone", "contactPhone", "tel")}
      </div>
      {error && (
        <div className="mt-3 rounded-md border border-fp-error/30 bg-fp-error/5 px-3 py-2 text-sm text-fp-error">
          {error}
          {existing && (
            <div className="mt-2 flex flex-wrap gap-2">
              <button type="button" className={secondaryButton} onClick={() => onUseExisting(existing)}>
                Use the existing customer
              </button>
              <button type="button" className={secondaryButton} onClick={() => save(true)} disabled={pending}>
                It&apos;s a different company: add anyway
              </button>
            </div>
          )}
        </div>
      )}
      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" className={primaryButton} onClick={() => save()} disabled={pending}>
          {pending ? "Adding…" : "Add customer"}
        </button>
        <button type="button" className={secondaryButton} onClick={onCancel} disabled={pending}>
          Cancel
        </button>
      </div>
      <p className="mt-2 text-xs text-fp-dark/70">
        You can fill in the rest (address, credit terms…) on the customer&apos;s page later.
      </p>
    </div>
  );
}

function CustomerPicker({
  initial,
  onPick,
  onAddNew,
  canAdd,
}: {
  initial: { id: string; name: string } | null;
  onPick: (c: CustomerHit) => void;
  onAddNew: (name: string) => void;
  canAdd: boolean;
}) {
  const [text, setText] = useState(initial?.name ?? "");
  const { results, searched, search, clear } = useSearch<CustomerHit>("/api/search/customers");
  return (
    <div className="relative">
      <input
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          search(e.target.value);
        }}
        placeholder="Start typing a customer name…"
        className={inputClass}
        autoComplete="off"
        required
      />
      {searched !== null && (results.length > 0 || canAdd) && (
        <ul className="absolute z-10 mt-1 max-h-72 w-full overflow-y-auto rounded-md border border-fp-border bg-white shadow-lg">
          {results.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                className="block w-full px-3 py-2 text-left text-sm hover:bg-fp-light"
                onClick={() => {
                  setText(c.name);
                  clear();
                  onPick(c);
                }}
              >
                <span className="font-semibold">{c.name}</span>
                {c.billing_city && <span className="text-fp-mid"> · {c.billing_city}</span>}
                {c.has_duplicate && (
                  <span className="ml-2 rounded-full bg-fp-amber/20 px-2 py-0.5 text-xs font-semibold">Possible duplicate</span>
                )}
                {c.credit_status && /ON STOP|Up Front|before we order/i.test(c.credit_status) && (
                  <span className="ml-2 text-xs font-semibold text-fp-error">{c.credit_status}</span>
                )}
              </button>
            </li>
          ))}
          {results.length === 0 && (
            <li className="px-3 py-2 text-sm text-fp-dark/70">No customers match &ldquo;{searched}&rdquo;.</li>
          )}
          {canAdd && (
            <li className="border-t border-fp-border">
              <button
                type="button"
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-semibold text-fp-teal-deep hover:bg-fp-light"
                onClick={() => {
                  const name = searched ?? text;
                  clear();
                  onAddNew(name);
                }}
              >
                <UserPlus size={14} aria-hidden /> Add &ldquo;{searched}&rdquo; as a new customer
              </button>
            </li>
          )}
        </ul>
      )}
    </div>
  );
}

export default function DocumentEditor({
  initialCustomer,
  initialContacts,
  initialContactId,
  initialLines,
  taxRates,
  creditWarning,
  canAddCustomer = false,
}: {
  initialCustomer: { id: string; name: string } | null;
  initialContacts: Contact[];
  initialContactId: string | null;
  initialLines: EditorLine[];
  taxRates: TaxRate[];
  creditWarning?: string | null;
  canAddCustomer?: boolean;
}) {
  const defaultTax = taxRates[0];
  const [customer, setCustomer] = useState(initialCustomer);
  const [contacts, setContacts] = useState<Contact[]>(initialContacts);
  const [contactId, setContactId] = useState<string>(initialContactId ?? "");
  const [credit, setCredit] = useState<string | null>(creditWarning ?? null);
  const [lines, setLines] = useState<EditorLine[]>(initialLines.length ? initialLines : [blankLine(defaultTax)]);
  const [adding, setAdding] = useState<string | null>(null);
  // Bumped to redraw the customer box with the chosen customer's proper name.
  const [pickerVersion, setPickerVersion] = useState(0);

  const pickCustomer = async (c: CustomerHit) => {
    setCustomer({ id: c.id, name: c.name });
    setCredit(c.credit_status && /ON STOP|Up Front|before we order/i.test(c.credit_status) ? c.credit_status : null);
    const res = await fetch(`/api/search/contacts?customer=${c.id}`);
    const list: Contact[] = res.ok ? await res.json() : [];
    setContacts(list);
    setContactId(list.find((p) => p.is_primary)?.id ?? list[0]?.id ?? "");
  };

  const update = (key: string, patch: Partial<EditorLine>) =>
    setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  const t = totals(lines);
  const margin = marginPercent(t.subtotal, t.cost);

  return (
    <div className="grid gap-6">
      <input type="hidden" name="customer_id" value={customer?.id ?? ""} />
      <input
        type="hidden"
        name="lines_json"
        value={JSON.stringify(
          lines
            .filter((l) => l.description.trim() || l.unit_price || l.product_id)
            .map((l) => ({
              id: l.key,
              product_id: l.product_id,
              description: l.description,
              quantity: l.quantity,
              unit_price: l.unit_price,
              unit_cost: l.unit_cost,
              discount_percent: l.discount_percent,
              tax_rate_id: l.tax_rate_id,
              tax_rate: l.tax_rate,
            })),
        )}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="grid gap-1 text-sm">
          <span className="font-semibold">Customer</span>
          {/* Re-created when a new customer is added, so the box shows its name. */}
          <CustomerPicker
            key={`${customer?.id ?? "none"}-${pickerVersion}`}
            initial={customer}
            onPick={pickCustomer}
            onAddNew={(name) => setAdding(name)}
            canAdd={canAddCustomer}
          />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="font-semibold">For the attention of</span>
          <select name="contact_id" value={contactId} onChange={(e) => setContactId(e.target.value)} className={inputClass}>
            <option value="">—</option>
            {contacts.map((p) => (
              <option key={p.id} value={p.id}>
                {[p.first_name, p.last_name].filter(Boolean).join(" ")}
                {p.email ? ` (${p.email})` : ""}
              </option>
            ))}
          </select>
        </label>
        {adding !== null && (
          <QuickAddCustomer
            initialName={adding}
            onCancel={() => setAdding(null)}
            onUseExisting={(c) => {
              setAdding(null);
              setPickerVersion((n) => n + 1);
              pickCustomer(c);
            }}
            onAdded={(c, contact) => {
              setAdding(null);
              setCustomer({ id: c.id, name: c.name });
              setCredit(null);
              setContacts(contact ? [contact] : []);
              setContactId(contact?.id ?? "");
            }}
          />
        )}
        {credit && (
          <p className="rounded-md border border-fp-error/30 bg-fp-error/5 px-3 py-2 text-sm text-fp-error sm:col-span-2">
            Credit warning for this customer: {credit}
          </p>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead className="border-b border-fp-border text-xs uppercase tracking-wide text-fp-mid">
            <tr>
              <th className="py-2 pr-2 font-semibold">Item</th>
              <th className="w-20 py-2 pr-2 font-semibold">Qty</th>
              <th className="w-28 py-2 pr-2 font-semibold">Price £</th>
              <th className="w-28 py-2 pr-2 font-semibold">Cost £</th>
              <th className="w-20 py-2 pr-2 font-semibold">Disc %</th>
              <th className="w-36 py-2 pr-2 font-semibold">VAT</th>
              <th className="w-28 py-2 pr-2 text-right font-semibold">Net</th>
              <th className="w-8" />
            </tr>
          </thead>
          <tbody>
            {lines.map((l) => (
              <tr key={l.key} className="border-b border-fp-border align-top">
                <td className="py-2 pr-2">
                  <div className="grid gap-1">
                    <ProductDropdown
                      selectedId={l.product_id}
                      onPick={(p) =>
                        update(l.key, {
                          product_id: p.id,
                          description: productLineText(p),
                          unit_price: p.sale_price,
                          unit_cost: p.cost_price,
                          tax_rate_id: p.tax_rate_id ?? l.tax_rate_id,
                          tax_rate: p.tax_rate_id ? p.tax_rate : l.tax_rate,
                        })
                      }
                    />
                    <textarea
                      value={l.description}
                      onChange={(e) => update(l.key, { description: e.target.value })}
                      rows={2}
                      placeholder="Description"
                      className={inputClass}
                    />
                  </div>
                </td>
                <td className="py-2 pr-2">
                  <input type="number" step="any" value={l.quantity} onChange={(e) => update(l.key, { quantity: num(e.target.value) })} className={inputClass} />
                </td>
                <td className="py-2 pr-2">
                  <input type="number" step="0.01" value={l.unit_price} onChange={(e) => update(l.key, { unit_price: num(e.target.value) })} className={inputClass} />
                </td>
                <td className="py-2 pr-2">
                  <input
                    type="number"
                    step="0.01"
                    value={l.unit_cost ?? ""}
                    onChange={(e) => update(l.key, { unit_cost: e.target.value === "" ? null : num(e.target.value) })}
                    className={inputClass}
                  />
                </td>
                <td className="py-2 pr-2">
                  <input
                    type="number"
                    step="0.5"
                    min={0}
                    max={100}
                    value={l.discount_percent}
                    onChange={(e) => update(l.key, { discount_percent: Math.min(100, Math.max(0, num(e.target.value))) })}
                    className={inputClass}
                  />
                </td>
                <td className="py-2 pr-2">
                  <select
                    value={l.tax_rate_id ?? ""}
                    onChange={(e) => {
                      const r = taxRates.find((x) => x.id === e.target.value);
                      update(l.key, { tax_rate_id: r?.id ?? null, tax_rate: r?.rate ?? 0 });
                    }}
                    className={inputClass}
                  >
                    {taxRates.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="py-2 pr-2 pt-4 text-right font-semibold">{money.format(lineNet(l))}</td>
                <td className="py-2 pt-3">
                  <button
                    type="button"
                    onClick={() => setLines((ls) => (ls.length > 1 ? ls.filter((x) => x.key !== l.key) : [blankLine(defaultTax)]))}
                    className="rounded p-1 text-fp-mid hover:bg-fp-light hover:text-fp-error"
                    aria-label="Remove line"
                  >
                    <Trash2 size={16} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-6">
        <button
          type="button"
          onClick={() => setLines((ls) => [...ls, blankLine(defaultTax)])}
          className="inline-flex items-center gap-1 text-sm font-semibold text-fp-teal-deep hover:underline"
        >
          <Plus size={14} /> Add line
        </button>
        <dl className="grid min-w-[260px] grid-cols-2 gap-x-6 gap-y-1 text-sm">
          <dt className="text-fp-dark/75">Subtotal</dt>
          <dd className="text-right">{money.format(t.subtotal)}</dd>
          <dt className="text-fp-dark/75">VAT</dt>
          <dd className="text-right">{money.format(t.vat)}</dd>
          <dt className="font-bold">Total</dt>
          <dd className="text-right font-bold">{money.format(t.total)}</dd>
          <dt className="mt-2 text-fp-mid">Cost</dt>
          <dd className="mt-2 text-right text-fp-mid">{money.format(t.cost)}</dd>
          <dt className="font-semibold text-fp-teal-deep">Margin</dt>
          <dd className="text-right font-semibold text-fp-teal-deep">{margin === null ? "—" : `${margin}%`}</dd>
        </dl>
      </div>
    </div>
  );
}
