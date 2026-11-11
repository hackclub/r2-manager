export function SettingsSkeleton() {
  return (
    <main className="px-6 py-8 lg:px-8" aria-busy="true" aria-label="Loading content">
      <h1 className="text-xl font-semibold text-kumo-strong">Settings</h1>
      <div className="mt-5 max-w-5xl animate-pulse space-y-5" aria-hidden="true">
        <div className="h-4 w-64 max-w-full rounded bg-kumo-tint" />
        <div className="h-11 rounded-lg border border-kumo-line bg-kumo-tint" />
        <div className="overflow-hidden rounded-lg border border-kumo-line">
          <div className="h-12 border-b border-kumo-line" />
          {[0, 1].map((i) => (
            <div key={i} className="h-12 border-b border-kumo-line bg-kumo-tint" />
          ))}
          <div className="h-12 bg-kumo-tint" />
        </div>
      </div>
    </main>
  );
}
