// A content item or campaign shown to someone who can view Marketing but not
// edit it. Links open in a new tab; empty fields show a dash.
export default function ReadOnlyDetails({ rows }: { rows: [string, string | null | undefined][] }) {
  return (
    <dl className="grid max-w-3xl gap-3 rounded-lg border border-fp-border bg-white p-6 text-sm sm:grid-cols-[180px_1fr]">
      {rows.map(([label, value]) => (
        <div key={label} className="contents">
          <dt className="font-semibold text-fp-dark/70">{label}</dt>
          <dd className="whitespace-pre-line break-words">
            {!value ? (
              "—"
            ) : /^https?:\/\//.test(value) ? (
              <a href={value} target="_blank" rel="noopener noreferrer" className="text-fp-teal-deep hover:underline">
                {value}
              </a>
            ) : (
              value
            )}
          </dd>
        </div>
      ))}
      <p className="text-xs text-fp-mid sm:col-span-2">You can view this but not change it. Ask an admin if you need edit access to Marketing.</p>
    </dl>
  );
}
