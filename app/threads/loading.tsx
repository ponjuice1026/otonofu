export default function ThreadsLoading() {
  return (
    <div className="page-shell" aria-busy="true" aria-live="polite">
      <header className="page-header">
        <div className="flex flex-wrap items-end justify-between gap-4 animate-pulse">
          <div>
            <div className="mb-2 h-3 w-24 rounded bg-[var(--surface-raised)]" />
            <div className="h-8 w-40 rounded-[var(--radius-md)] bg-[var(--surface-raised)]" />
            <div className="mt-3 h-4 w-96 max-w-full rounded bg-[var(--surface-raised)]" />
          </div>
          <div className="h-10 w-40 rounded-[var(--radius-md)] bg-[var(--surface-raised)]" />
        </div>
      </header>

      <section className="mb-14 animate-pulse">
        <div className="section-header">
          <div>
            <div className="h-5 w-44 rounded bg-[var(--surface-raised)]" />
            <div className="mt-2 h-3 w-56 rounded bg-[var(--surface-raised)]" />
          </div>
        </div>
        <div className="flex gap-4 overflow-hidden">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-46 w-64 shrink-0 rounded-[var(--radius-xl)] bg-[var(--surface-raised)]"
              style={{ height: "11.5rem" }}
            />
          ))}
        </div>
      </section>

      <section className="animate-pulse">
        <div className="section-header">
          <div>
            <div className="h-5 w-36 rounded bg-[var(--surface-raised)]" />
            <div className="mt-2 h-3 w-24 rounded bg-[var(--surface-raised)]" />
          </div>
        </div>
        <ul className="flex flex-col gap-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <li
              key={i}
              className="rounded-[var(--radius-xl)] bg-[var(--surface-raised)] px-4 py-4"
            >
              <div className="h-4 w-2/3 rounded bg-[var(--surface-hover)]" />
              <div className="mt-2 h-3 w-full max-w-md rounded bg-[var(--surface-hover)]" />
              <div className="mt-3 h-3 w-1/2 rounded bg-[var(--surface-hover)]" />
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
