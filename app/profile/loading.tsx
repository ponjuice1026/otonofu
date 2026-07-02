export default function ProfileLoading() {
  return (
    <div className="page-shell mx-auto max-w-2xl" aria-busy="true" aria-live="polite">
      <header className="page-header flex items-center gap-4 animate-pulse">
        <div className="h-16 w-16 shrink-0 rounded-full bg-[var(--surface-raised)]" />
        <div className="min-w-0 flex-1">
          <div className="h-7 w-40 rounded-[var(--radius-md)] bg-[var(--surface-raised)]" />
          <div className="mt-2 h-3 w-24 rounded bg-[var(--surface-raised)]" />
        </div>
      </header>

      <div className="surface-panel mb-6 h-20 animate-pulse px-5 py-4" />
      <div className="surface-panel mb-6 animate-pulse px-5 py-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-16 rounded-[var(--radius-md)] bg-[var(--surface-raised)]"
            />
          ))}
        </div>
      </div>
      <div className="surface-panel mb-8 h-28 animate-pulse px-5 py-4" />
    </div>
  );
}
