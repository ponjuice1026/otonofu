import Link from "next/link";
import { AlbumCover } from "@/components/spotify/AlbumCover";
import { ArtistLink } from "@/components/artist/ArtistLink";
import { StarRating } from "@/components/ui/StarRating";
import { albumCoverSrc } from "@/lib/covers";
import { rankNumClass } from "@/lib/rank-tone";
import type { Album } from "@/lib/types";

type AlbumRankingListProps = {
  albums: Album[];
  artistNames: Map<string, string>;
  startRank?: number;
};

export function AlbumRankingList({
  albums,
  artistNames,
  startRank = 1,
}: AlbumRankingListProps) {
  if (albums.length === 0) {
    return (
      <p className="empty-state">まだ評価されたアルバムはありません。</p>
    );
  }

  return (
    <ol className="list-panel">
      {albums.map((album, index) => {
        const rank = startRank + index;

        return (
        <li
          key={album.id}
          className="flex items-center gap-4 px-4 py-3.5 transition hover:bg-[var(--surface-hover)]/60"
        >
          <span className={`${rankNumClass(rank)} w-10 shrink-0 text-center`}>
            {rank}
          </span>
          <Link href={`/albums/${album.id}`} className="shrink-0">
            <AlbumCover
              imageUrl={albumCoverSrc(album)}
              fallbackColor={album.coverColor}
              title={album.title}
              size="sm"
            />
          </Link>
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold text-neutral-100">
              <Link
                href={`/albums/${album.id}`}
                className="transition hover:text-white"
              >
                {album.title}
              </Link>
            </p>
            <p className="truncate text-sm text-neutral-500">
              <ArtistLink
                artistId={album.artistId}
                name={artistNames.get(album.artistId)}
                className="text-neutral-500"
              />
            </p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-0.5">
            <StarRating value={album.avgRating} size="md" />
            <span className="num-stat text-sm text-neutral-500">
              {album.ratingCount.toLocaleString("ja-JP")} 件
            </span>
          </div>
        </li>
        );
      })}
    </ol>
  );
}
