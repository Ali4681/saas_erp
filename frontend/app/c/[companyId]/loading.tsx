export default function CompanyLoading() {
  return (
    <div className="space-y-4 animate-pulse" aria-busy="true" aria-live="polite">
      <div className="h-8 w-48 rounded-lg bg-[var(--muted)]/60" />
      <div className="h-4 w-72 rounded bg-[var(--muted)]/40" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-24 rounded-2xl border border-[var(--border)] bg-[var(--card)]"
          />
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="h-28 rounded-2xl border border-[var(--border)] bg-[var(--card)]"
          />
        ))}
      </div>
    </div>
  );
}
