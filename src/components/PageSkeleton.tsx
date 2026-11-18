// A light grey outline of a page, shown the moment someone clicks while the
// real page loads (used by the loading.tsx files). `withHeader` also draws the
// page title band, for sections that don't keep their own header on screen.
function Block({ className }: { className: string }) {
  return <div className={`fp-skeleton rounded-md ${className}`} />;
}

export default function PageSkeleton({ withHeader = false }: { withHeader?: boolean }) {
  return (
    <div aria-busy="true" aria-label="Loading" className="fp-skeleton-fade">
      {withHeader && (
        <div className="border-b border-fp-border bg-white px-6 py-8 lg:px-10">
          <Block className="h-7 w-56" />
          <Block className="mt-3 h-4 w-96 max-w-full" />
        </div>
      )}
      <div className={`grid gap-6 ${withHeader ? "px-6 py-8 lg:px-10" : ""}`}>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="rounded-lg border border-fp-border bg-white p-4">
              <Block className="h-3 w-24" />
              <Block className="mt-3 h-7 w-32" />
              <Block className="mt-2 h-3 w-40" />
            </div>
          ))}
        </div>
        <div className="grid gap-6 xl:grid-cols-2">
          {[0, 1].map((i) => (
            <div key={i} className="rounded-lg border border-fp-border bg-white p-6">
              <Block className="h-4 w-40" />
              <div className="mt-5 grid gap-3">
                {[0, 1, 2, 3, 4].map((j) => (
                  <Block key={j} className="h-4 w-full" />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
      <span className="sr-only">Loading…</span>
    </div>
  );
}
