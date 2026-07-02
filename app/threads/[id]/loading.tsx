export default function ThreadDetailLoading() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8" aria-busy="true" aria-live="polite">
      <div className="mb-6 h-4 w-28 animate-pulse rounded bg-[var(--surface-raised)]" />

      <article className="mb-8 animate-pulse rounded-lg bg-[var(--surface-raised)] px-5 py-5">
        <div className="mb-2 h-3 w-20 rounded bg-[var(--surface-hover)]" />
        <div className="h-7 w-3/4 rounded bg-[var(--surface-hover)]" />
        <div className="mt-4 space-y-2">
          <div className="h-3 w-full rounded bg-[var(--surface-hover)]" />
          <div className="h-3 w-full rounded bg-[var(--surface-hover)]" />
          <div className="h-3 w-2/3 rounded bg-[var(--surface-hover)]" />
        </div>
        <div className="mt-4 h-3 w-1/2 rounded bg-[var(--surface-hover)]" />
      </article>

      <div className="flex flex-col gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="animate-pulse rounded-[var(--radius-md)] bg-[var(--surface-raised)] px-4 py-3"
          >
            <div className="flex items-center gap-2">
              <div className="h-6 w-6 shrink-0 rounded-full bg-[var(--surface-hover)]" />
              <div className="h-3 w-20 rounded bg-[var(--surface-hover)]" />
              <div className="h-3 w-16 rounded bg-[var(--surface-hover)]" />
            </div>
            <div className="mt-2 space-y-2">
              <div className="h-3 w-full rounded bg-[var(--surface-hover)]" />
              <div className="h-3 w-4/5 rounded bg-[var(--surface-hover)]" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
