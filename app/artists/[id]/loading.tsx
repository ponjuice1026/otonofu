export default function ArtistDetailLoading() {
  return (
    <div className="page-shell" aria-busy="true" aria-live="polite">
      <div className="mb-6 h-4 w-24 animate-pulse rounded bg-[var(--surface-raised)]" />

      <header className="mb-10 border-b border-[var(--border)] pb-8">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start animate-pulse">
          <div className="h-40 w-40 shrink-0 rounded-full bg-[var(--surface-raised)]" />
          <div className="flex-1">
            <div className="h-9 w-56 rounded-[var(--radius-md)] bg-[var(--surface-raised)]" />
            <div className="mt-3 h-5 w-40 rounded bg-[var(--surface-raised)]" />
            <div className="mt-4 flex flex-wrap gap-4">
              <div className="h-4 w-24 rounded bg-[var(--surface-raised)]" />
              <div className="h-4 w-32 rounded bg-[var(--surface-raised)]" />
              <div className="h-4 w-28 rounded bg-[var(--surface-raised)]" />
            </div>
          </div>
        </div>
      </header>

      <section className="mb-12 animate-pulse">
        <div className="mb-4 h-5 w-40 rounded bg-[var(--surface-raised)]" />
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex flex-col gap-2">
              <div className="aspect-square w-full rounded-[var(--radius-lg)] bg-[var(--surface-raised)]" />
              <div className="h-3 w-4/5 rounded bg-[var(--surface-raised)]" />
              <div className="h-3 w-3/5 rounded bg-[var(--surface-raised)]" />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
