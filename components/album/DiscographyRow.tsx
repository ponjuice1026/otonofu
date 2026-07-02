import Link from "next/link";
import Image from "next/image";
import type { Album } from "@/lib/types";
import { albumCoverSrc } from "@/lib/covers";
import { getReleaseTypeLabel } from "@/lib/release-types";
import { StarRating } from "@/components/ui/StarRating";

type DiscographyRowProps = {
  album: Album;
  fromArtist?: boolean;
};

export function DiscographyRow({ album, fromArtist }: DiscographyRowProps) {
  const href = fromArtist
    ? `/albums/${album.id}?from=artist`
    : `/albums/${album.id}`;
  return (
    <Link
      href={href}
      className="flex items-center gap-4 rounded-lg border border-zinc-800 px-4 py-3 transition hover:border-amber-500/40 hover:bg-zinc-900/50"
    >
      {(album.coverUrl || album.spotifyId) ? (
        <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded bg-zinc-800">
          <Image src={albumCoverSrc(album)!} alt="" fill className="object-cover" sizes="56px" quality={90} />
        </div>
      ) : (
        <div
          className="h-14 w-14 shrink-0 rounded"
          style={{ backgroundColor: album.coverColor }}
          aria-hidden
        />
      )}
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-zinc-100">{album.title}</p>
        <p className="text-sm text-zinc-500">
          {album.year} · {getReleaseTypeLabel(album.type)} · {album.genre}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2 text-sm">
        <StarRating value={album.avgRating} size="sm" />
        <span className="text-zinc-500">
          ({album.ratingCount.toLocaleString("ja-JP")})
        </span>
      </div>
    </Link>
  );
}
