"use client";

import { useState } from "react";
import { DiscographyRow } from "@/components/album/DiscographyRow";
import type { Album } from "@/lib/types";

type OtherReleasesSectionProps = {
  releases: Album[];
};

export function OtherReleasesSection({ releases }: OtherReleasesSectionProps) {
  const [expanded, setExpanded] = useState(false);

  if (releases.length === 0) {
    return null;
  }

  return (
    <section>
      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        aria-expanded={expanded}
        className="group flex items-center gap-2 text-lg font-semibold text-zinc-100 transition hover:text-amber-300"
      >
        <span
          className={`text-sm text-zinc-500 transition group-hover:text-amber-400/80 ${
            expanded ? "rotate-90" : ""
          }`}
          aria-hidden
        >
          ▶
        </span>
        その他のリリース
        <span className="text-sm font-normal text-zinc-500">
          {releases.length} 件
        </span>
      </button>

      {expanded && (
        <div className="mt-4 flex flex-col gap-2">
          {releases.map((album) => (
            <DiscographyRow key={album.id} album={album} fromArtist />
          ))}
        </div>
      )}
    </section>
  );
}
