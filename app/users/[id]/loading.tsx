export default function PublicUserLoading() {
  return (
    <div className="page-shell mx-auto max-w-2xl" aria-busy="true" aria-live="polite">
      <header className="page-header flex items-center gap-4 animate-pulse">
        <div className="h-16 w-16 shrink-0 rounded-full bg-[var(--surface-raised)]" />
        <div className="flex-1">
          <div className="h-7 w-48 rounded-[var(--radius-md)] bg-[var(--surface-raised)]" />
          <div className="mt-2 h-4 w-32 rounded bg-[var(--surface-raised)]" />
        </div>
      </header>

      <section className="surface-panel mb-6 px-5 py-4 animate-pulse">
        <div className="mb-3 h-4 w-20 rounded bg-[var(--surface-raised)]" />
        <div className="h-4 w-full rounded bg-[var(--surface-raised)]" />
        <div className="mt-2 h-4 w-3/4 rounded bg-[var(--surface-raised)]" />
      </section>

      <section className="surface-panel mb-6 px-5 py-4 animate-pulse">
        <div className="mb-3 h-4 w-16 rounded bg-[var(--surface-raised)]" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-16 rounded-[var(--radius-md)] bg-[var(--surface-raised)]"
            />
          ))}
        </div>
      </section>

      <section className="surface-panel mb-8 px-5 py-5 animate-pulse">
        <div className="mb-4 h-5 w-32 rounded bg-[var(--surface-raised)]" />
        <div className="flex flex-col gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="h-28 rounded-[var(--radius-lg)] bg-[var(--surface-raised)]"
            />
          ))}
        </div>
      </section>
    </div>
  );
}
