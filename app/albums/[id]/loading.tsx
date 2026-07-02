export default function AlbumDetailLoading() {
  return (
    <div className="page-shell" aria-busy="true" aria-live="polite">
      <div className="mb-6 h-4 w-24 animate-pulse rounded bg-[var(--surface-raised)]" />

      <div className="mb-10 flex flex-col gap-8 sm:flex-row animate-pulse">
        <div className="h-48 w-48 shrink-0 rounded-[var(--radius-lg)] bg-[var(--surface-raised)] sm:h-56 sm:w-56" />
        <div className="flex-1">
          <div className="h-3 w-48 rounded bg-[var(--surface-raised)]" />
          <div className="mt-3 h-9 w-3/4 rounded-[var(--radius-md)] bg-[var(--surface-raised)]" />
          <div className="mt-3 h-5 w-40 rounded bg-[var(--surface-raised)]" />
          <div className="mt-5 h-6 w-56 rounded bg-[var(--surface-raised)]" />
          <div className="mt-6 h-24 w-full rounded-[var(--radius-lg)] bg-[var(--surface-raised)]" />
        </div>
      </div>

      <section className="mt-10 animate-pulse">
        <div className="mb-4 h-5 w-24 rounded bg-[var(--surface-raised)]" />
        <div className="flex flex-col gap-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center gap-3 rounded-[var(--radius-md)] bg-[var(--surface-raised)] px-3 py-3"
            >
              <div className="h-4 w-4 shrink-0 rounded bg-[var(--surface-hover)]" />
              <div className="h-3 flex-1 rounded bg-[var(--surface-hover)]" />
              <div className="h-3 w-10 shrink-0 rounded bg-[var(--surface-hover)]" />
            </div>
          ))}
        </div>
      </section>

      <section className="mt-10 animate-pulse">
        <div className="mb-4 h-5 w-32 rounded bg-[var(--surface-raised)]" />
        <div className="flex flex-col gap-4">
          {Array.from({ length: 2 }).map((_, i) => (
            <div
              key={i}
              className="h-28 w-full rounded-[var(--radius-xl)] bg-[var(--surface-raised)]"
            />
          ))}
        </div>
      </section>
    </div>
  );
}
