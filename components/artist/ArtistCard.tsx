import Image from "next/image";
import Link from "next/link";
import type { Artist } from "@/lib/types";
import { artistImageSrc } from "@/lib/covers";

type ArtistCardProps = {
  artist: Artist;
  releaseCount: number;
};

export function ArtistCard({ artist, releaseCount }: ArtistCardProps) {
  const imageSrc = artistImageSrc(artist);

  return (
    <Link
      href={`/artists/${artist.id}`}
      className="card-interactive group flex gap-4 p-4"
    >
      <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-full bg-[var(--surface-raised)] ring-1 ring-[var(--border)]">
        {imageSrc ? (
          <Image
            src={imageSrc}
            alt={artist.name}
            fill
            className="object-cover"
            sizes="64px"
            quality={90}
          />
        ) : (
          <div
            className="h-full w-full"
            style={{ backgroundColor: "#262626" }}
            aria-hidden
          />
        )}
      </div>
      <div className="min-w-0">
        <h3 className="text-lg font-semibold text-neutral-100 transition group-hover:text-white">
          {artist.name}
        </h3>
        {artist.nameEn && (
          <p className="text-sm text-neutral-500">{artist.nameEn}</p>
        )}
        <p className="mt-2 line-clamp-2 text-sm text-neutral-400">{artist.bio}</p>
        <div className="mt-3 flex flex-wrap gap-2 text-xs text-neutral-500">
          <span>{artist.origin}</span>
          <span>·</span>
          <span>
            {artist.activeFrom}
            {artist.activeTo ? `–${artist.activeTo}` : "–"}
          </span>
          <span>·</span>
          <span>{releaseCount} リリース</span>
        </div>
      </div>
    </Link>
  );
}
