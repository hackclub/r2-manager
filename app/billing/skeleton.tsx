export function BillingSkeleton() {
  return (
    <section className="space-y-5" aria-label="Loading billing usage" aria-busy="true">
      <output className="sr-only">Loading billing usage…</output>
      <div className="space-y-5 motion-safe:animate-pulse" aria-hidden="true">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="rounded-lg border border-kumo-line p-5">
              <div className="h-5 w-32 max-w-full rounded bg-kumo-tint" />
              <div className="mt-3 h-8 w-24 rounded bg-kumo-tint" />
            </div>
          ))}
        </div>
        <div className="overflow-x-auto rounded-lg border border-kumo-line">
          <div className="min-w-[720px]">
            {[0, 1, 2, 3, 4, 5].map((row) => (
              <div
                key={row}
                className="grid grid-cols-6 gap-4 border-b border-kumo-line px-4 py-4 last:border-0"
              >
                {[0, 1, 2, 3, 4, 5].map((col) => (
                  <div key={col} className="space-y-2">
                    <div
                      className={`h-5 max-w-full rounded bg-kumo-tint ${col === 0 ? "w-32" : "w-20"}`}
                    />
                    {row > 0 && col > 0 && col < 5 && (
                      <div className="h-4 w-24 max-w-full rounded bg-kumo-tint" />
                    )}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
