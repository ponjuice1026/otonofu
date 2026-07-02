export default function SearchLoading() {
  return (
    <div className="page-shell" aria-busy="true" aria-live="polite">
      <header className="page-header animate-pulse">
        <div className="h-8 w-24 rounded-[var(--radius-md)] bg-[var(--surface-raised)]" />
        <div className="mt-3 h-4 w-96 max-w-full rounded bg-[var(--surface-raised)]" />
      </header>

      <div className="mb-8 h-11 w-full animate-pulse rounded-[var(--radius-md)] bg-[var(--surface-raised)]" />

      <div className="animate-pulse space-y-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-16 w-full rounded-[var(--radius-xl)] bg-[var(--surface-raised)]"
          />
        ))}
      </div>
    </div>
  );
}
