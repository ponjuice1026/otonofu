"use client";

import { useState } from "react";

export const EXPANDABLE_TEXT_LIMIT = 100;

type ExpandableTextProps = {
  text: string;
  limit?: number;
  className?: string;
  emptyFallback?: string;
};

export function ExpandableText({
  text,
  limit = EXPANDABLE_TEXT_LIMIT,
  className = "text-[0.9375rem] leading-relaxed text-neutral-300",
  emptyFallback,
}: ExpandableTextProps) {
  const [expanded, setExpanded] = useState(false);
  const trimmed = text.trim();
  const isLong = trimmed.length > limit;
  const displayText =
    expanded || !isLong ? trimmed : `${trimmed.slice(0, limit)}…`;

  if (!trimmed) {
    if (!emptyFallback) return null;
    return <p className={`${className} italic text-neutral-500`}>{emptyFallback}</p>;
  }

  return (
    <div>
      <p className={`whitespace-pre-wrap ${className}`}>{displayText}</p>
      {isLong && !expanded && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="mt-1 text-xs text-neutral-300 transition hover:text-white hover:underline"
        >
          すべて見る
        </button>
      )}
    </div>
  );
}
