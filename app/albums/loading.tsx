export default function AlbumsLoading() {
  return (
    <div className="page-shell" aria-busy="true" aria-live="polite">
      <header className="page-header animate-pulse">
        <div className="h-8 w-32 rounded-[var(--radius-md)] bg-[var(--surface-raised)]" />
        <div className="mt-3 h-4 w-56 rounded bg-[var(--surface-raised)]" />
      </header>

      <section className="mb-14 animate-pulse">
        <div className="section-header">
          <div>
            <div className="h-6 w-32 rounded bg-[var(--surface-raised)]" />
            <div className="mt-2 h-3 w-48 rounded bg-[var(--surface-raised)]" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="flex flex-col gap-2">
              <div className="aspect-square w-full rounded-[var(--radius-lg)] bg-[var(--surface-raised)]" />
              <div className="h-3 w-4/5 rounded bg-[var(--surface-raised)]" />
              <div className="h-3 w-1/2 rounded bg-[var(--surface-raised)]" />
            </div>
          ))}
        </div>
      </section>

      <section className="animate-pulse">
        <div className="section-header">
          <div className="h-6 w-40 rounded bg-[var(--surface-raised)]" />
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex flex-col gap-2">
              <div className="aspect-square w-full rounded-[var(--radius-lg)] bg-[var(--surface-raised)]" />
              <div className="h-3 w-4/5 rounded bg-[var(--surface-raised)]" />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
