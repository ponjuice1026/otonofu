"use client";

import { useEffect, useState, type ReactNode } from "react";

type ProfileExpandableSectionProps = {
  id: string;
  title: string;
  count: number;
  children: ReactNode;
};

export function ProfileExpandableSection({
  id,
  title,
  count,
  children,
}: ProfileExpandableSectionProps) {
  const [expanded, setExpanded] = useState(count === 0);

  useEffect(() => {
    const expandFromHash = () => {
      if (window.location.hash === `#${id}`) {
        setExpanded(true);
      }
    };

    expandFromHash();
    window.addEventListener("hashchange", expandFromHash);
    return () => window.removeEventListener("hashchange", expandFromHash);
  }, [id]);

  return (
    <section
      id={id}
      className="surface-panel mb-8 scroll-mt-8 px-5 py-5 last:mb-0"
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="section-title">
          {title}
          <span className="ml-2 text-sm font-normal text-neutral-500">
            {count} 件
          </span>
        </h2>
        {count > 0 && !expanded && (
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="text-sm text-neutral-400 transition hover:text-amber-300"
          >
            すべて表示
          </button>
        )}
      </div>
      {expanded ? children : null}
    </section>
  );
}
