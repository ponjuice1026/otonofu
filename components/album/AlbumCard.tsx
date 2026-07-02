import Link from "next/link";
import { AlbumCover } from "@/components/spotify/AlbumCover";
import { ArtistLink } from "@/components/artist/ArtistLink";
import type { Album } from "@/lib/types";
import { albumCoverSrc } from "@/lib/covers";
import { StarRating } from "@/components/ui/StarRating";

type AlbumCardProps = {
  album: Album;
  artistName?: string;
};

export function AlbumCard({ album, artistName }: AlbumCardProps) {
  return (
    <article className="card-interactive group flex flex-col overflow-hidden">
      <Link href={`/albums/${album.id}`} className="block">
        <AlbumCover
          imageUrl={albumCoverSrc(album)}
          fallbackColor={album.coverColor}
          title={album.title}
          size="card"
        />
        <h3 className="line-clamp-2 px-3 pt-3 text-sm font-semibold leading-snug text-neutral-100 transition group-hover:text-white">
          {album.title}
        </h3>
      </Link>
      <div className="flex flex-1 flex-col gap-1 px-3 pb-3">
        <p className="text-xs text-neutral-500">
          <ArtistLink artistId={album.artistId} name={artistName} />
        </p>
          <div className="mt-auto flex items-center justify-between pt-2 text-sm text-neutral-500">
            <span>{album.year}</span>
            <div className="flex items-center gap-1.5">
              <StarRating value={album.avgRating} size="sm" />
              <span className="num-stat">({album.ratingCount.toLocaleString("ja-JP")})</span>
          </div>
        </div>
      </div>
    </article>
  );
}
