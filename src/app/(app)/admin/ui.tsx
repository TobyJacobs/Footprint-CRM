// Small shared pieces for the admin screens.

export const inputClass =
  "w-full rounded-md border border-fp-border bg-white px-3 py-2 text-sm focus:border-fp-pink focus:outline-none focus:ring-2 focus:ring-fp-pink/20";

export const primaryButton =
  "rounded-md bg-fp-pink px-4 py-2 text-sm font-semibold text-white hover:bg-fp-pink/90";

export const dangerButton =
  "rounded-md border border-fp-error/40 px-4 py-2 text-sm font-semibold text-fp-error hover:bg-fp-error/5";

export function Notice({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const { error, saved, deleted } = searchParams;
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

export function Card({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-fp-border bg-white p-6">
      {title && <h2 className="mb-4 font-bold">{title}</h2>}
      {children}
    </section>
  );
}
