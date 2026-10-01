// Small shared building blocks for forms and pages.

export const inputClass =
  "w-full rounded-md border border-fp-border bg-white px-3 py-2 text-sm focus:border-fp-pink focus:outline-none focus:ring-2 focus:ring-fp-pink/20";

export const primaryButton =
  "rounded-md bg-fp-pink px-4 py-2 text-sm font-semibold text-white hover:bg-fp-pink/90";

export const secondaryButton =
  "rounded-md border border-fp-border bg-white px-4 py-2 text-sm font-semibold hover:bg-fp-light";

export const dangerButton =
  "rounded-md border border-fp-error/40 px-4 py-2 text-sm font-semibold text-fp-error hover:bg-fp-error/5";

export function Notice({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const { error, saved, deleted, erased } = searchParams;
  if (erased) {
    return (
      <p role="status" className="mb-6 rounded-md border border-fp-teal-deep/30 bg-fp-teal/10 px-4 py-3 text-sm text-fp-teal-deep">
        Personal data erased. The erasure is recorded in the audit log.
      </p>
    );
  }
  if (typeof error === "string") {
    return (
      <p role="alert" className="mb-6 rounded-md border border-fp-error/30 bg-fp-error/5 px-4 py-3 text-sm text-fp-error">
        {error}
      </p>
    );
  }
  if (saved || deleted) {
    return (
      <p role="status" className="mb-6 rounded-md border border-fp-teal-deep/30 bg-fp-teal/10 px-4 py-3 text-sm text-fp-teal-deep">
        {saved ? "Changes saved." : "Deleted."}
      </p>
    );
  }
  return null;
}

export function Card({
  title,
  action,
  children,
}: {
  title?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-fp-border bg-white p-6">
      {(title || action) && (
        <div className="mb-4 flex items-center justify-between gap-4">
          {title && <h2 className="font-bold">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function Field({
  label,
  hint,
  children,
  wide,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <label className={`grid gap-1 text-sm ${wide ? "sm:col-span-2" : ""}`}>
      <span className="font-semibold">{label}</span>
      {children}
      {hint && <span className="text-xs text-fp-mid">{hint}</span>}
    </label>
  );
}

export function TextInput({
  name,
  defaultValue,
  type = "text",
  required,
  placeholder,
  step,
}: {
  name: string;
  defaultValue?: string | number | null;
  type?: string;
  required?: boolean;
  placeholder?: string;
  step?: string;
}) {
  return (
    <input
      name={name}
      type={type}
      required={required}
      placeholder={placeholder}
      step={step}
      defaultValue={defaultValue ?? ""}
      className={inputClass}
    />
  );
}

export function TextArea({ name, defaultValue, rows = 3 }: { name: string; defaultValue?: string | null; rows?: number }) {
  return <textarea name={name} rows={rows} defaultValue={defaultValue ?? ""} className={inputClass} />;
}

export function Select({
  name,
  options,
  defaultValue,
  blank = "—",
}: {
  name: string;
  options: readonly string[] | readonly { value: string; label: string }[];
  defaultValue?: string | null;
  blank?: string | false;
}) {
  const opts = options.map((o) => (typeof o === "string" ? { value: o, label: o } : o));
  // Keep an imported value that isn't in our list, rather than silently losing it.
  if (defaultValue && !opts.some((o) => o.value === defaultValue)) {
    opts.push({ value: defaultValue, label: `${defaultValue} (from Zoho)` });
  }
  return (
    <select name={name} defaultValue={defaultValue ?? ""} className={inputClass}>
      {blank !== false && <option value="">{blank}</option>}
      {opts.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export function CheckboxGroup({
  name,
  options,
  selected = [],
}: {
  name: string;
  options: readonly string[];
  selected?: string[] | null;
}) {
  const all = [...options, ...(selected ?? []).filter((s) => !options.includes(s))];
  return (
    <div className="flex flex-wrap gap-x-5 gap-y-2 pt-1">
      {all.map((o) => (
        <label key={o} className="flex items-center gap-2 text-sm">
          <input type="checkbox" name={name} value={o} defaultChecked={selected?.includes(o)} className="accent-fp-pink" />
          {o}
        </label>
      ))}
    </div>
  );
}

export function Checkbox({ name, label, defaultChecked }: { name: string; label: string; defaultChecked?: boolean | null }) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <input type="checkbox" name={name} defaultChecked={defaultChecked ?? false} className="accent-fp-pink" />
      {label}
    </label>
  );
}

export function Badge({ children, tone = "grey" }: { children: React.ReactNode; tone?: "grey" | "teal" | "pink" | "amber" | "red" }) {
  const tones = {
    grey: "bg-fp-light text-fp-dark",
    teal: "bg-fp-teal/15 text-fp-teal-deep",
    pink: "bg-fp-pink/10 text-fp-pink",
    amber: "bg-fp-amber/20 text-fp-dark",
    red: "bg-fp-error/10 text-fp-error",
  };
  return <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${tones[tone]}`}>{children}</span>;
}
