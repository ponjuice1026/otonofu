export default function Loading() {
  return (
    <div className="page-shell" aria-busy="true" aria-live="polite">
      <div className="page-header animate-pulse">
        <div className="h-8 w-56 rounded-[var(--radius-md)] bg-[var(--surface-raised)]" />
        <div className="mt-3 h-4 w-80 max-w-full rounded-[var(--radius-md)] bg-[var(--surface-raised)]" />
      </div>

      <div className="mb-10 animate-pulse">
        <div className="section-header">
          <div className="h-6 w-40 rounded-[var(--radius-md)] bg-[var(--surface-raised)]" />
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex flex-col gap-2">
              <div className="aspect-square w-full rounded-[var(--radius-lg)] bg-[var(--surface-raised)]" />
              <div className="h-3 w-4/5 rounded bg-[var(--surface-raised)]" />
              <div className="h-3 w-3/5 rounded bg-[var(--surface-raised)]" />
            </div>
          ))}
        </div>
      </div>

      <div className="animate-pulse">
        <div className="section-header">
          <div className="h-6 w-32 rounded-[var(--radius-md)] bg-[var(--surface-raised)]" />
        </div>
        <div className="flex flex-col gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-16 w-full rounded-[var(--radius-xl)] bg-[var(--surface-raised)]"
            />
          ))}
        </div>
      </div>
    </div>
  );
}
