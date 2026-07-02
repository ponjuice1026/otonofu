import Image from "next/image";
import Link from "next/link";
import { ArtistLink } from "@/components/artist/ArtistLink";
import { AlbumCover } from "@/components/spotify/AlbumCover";
import type { SiteSearchResult } from "@/lib/data/search";
import { formatThreadDate } from "@/lib/threads/format";

type SearchResultsProps = {
  query: string;
  results: SiteSearchResult;
};

function albumCoverSrcFromHit(coverUrl?: string, spotifyId?: string): string | undefined {
  if (coverUrl) return coverUrl;
  if (spotifyId) return `/api/covers/album/${spotifyId}`;
  return undefined;
}

function artistImageSrc(imageUrl?: string, spotifyId?: string): string | undefined {
  if (imageUrl) return imageUrl;
  if (spotifyId) return `/api/covers/artist/${spotifyId}`;
  return undefined;
}

function Section({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: React.ReactNode;
}) {
  if (count === 0) return null;

  return (
    <section className="mb-10">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-neutral-500">
        {title}
        <span className="ml-2 text-neutral-600">({count})</span>
      </h2>
      {children}
    </section>
  );
}

export function SearchResults({ query, results }: SearchResultsProps) {
  const {
    threads,
    posts,
    reviews,
    artists,
    albums,
  } = results;

  return (
    <div>
      <p className="mb-6 text-sm text-neutral-500">
        「{query}」の検索結果
      </p>

      <Section title="セッション" count={threads.length}>
        <ul className="flex flex-col gap-2">
          {threads.map((thread) => (
            <li key={thread.id}>
              <Link
                href={`/threads/${thread.id}`}
                className="card-interactive block px-4 py-3.5"
              >
                <h3 className="font-semibold text-neutral-100">{thread.title}</h3>
                <p className="mt-1 line-clamp-2 text-sm text-neutral-500">
                  {thread.snippet}
                </p>
                <p className="mt-2 text-xs text-neutral-600">
                  {thread.authorName} · {formatThreadDate(thread.updatedAt)}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="コメント" count={posts.length}>
        <ul className="flex flex-col gap-2">
          {posts.map((post) => (
            <li key={post.id}>
              <Link
                href={`/threads/${post.threadId}#post-${post.id}`}
                className="card-interactive block px-4 py-3.5"
              >
                <p className="text-xs text-neutral-500">
                  {post.threadTitle} · {post.anonymousName}
                </p>
                <p className="mt-1 line-clamp-2 text-sm text-neutral-200">
                  {post.snippet}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="レビュー" count={reviews.length}>
        <ul className="flex flex-col gap-2">
          {reviews.map((review) => (
            <li key={review.id}>
              <Link
                href={`/albums/${review.albumId}#review-${review.id}`}
                className="card-interactive block px-4 py-3.5"
              >
                <p className="font-semibold text-neutral-100">
                  {review.albumTitle}
                  <span className="ml-2 text-sm font-normal text-amber-300">
                    {review.rating.toFixed(1)}
                  </span>
                </p>
                <p className="mt-1 line-clamp-2 text-sm text-neutral-500">
                  {review.snippet}
                </p>
                <p className="mt-2 text-xs text-neutral-600">{review.username}</p>
              </Link>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="アーティスト" count={artists.length}>
        <ul className="flex flex-col gap-2">
          {artists.map((artist) => {
            const imageSrc = artistImageSrc(artist.imageUrl, artist.spotifyId);
            return (
              <li key={artist.id}>
                <Link
                  href={`/artists/${artist.id}`}
                  className="card-interactive flex items-center gap-3 px-4 py-3"
                >
                  <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full bg-[var(--surface-raised)] ring-1 ring-[var(--border)]">
                    {imageSrc ? (
                      <Image
                        src={imageSrc}
                        alt=""
                        fill
                        className="object-cover"
                        sizes="40px"
                      />
                    ) : null}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-medium text-neutral-100">
                      {artist.name}
                    </p>
                    {artist.nameEn && (
                      <p className="truncate text-xs text-neutral-500">
                        {artist.nameEn}
                      </p>
                    )}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      </Section>

      <Section title="アルバム" count={albums.length}>
        <ul className="flex flex-col gap-2">
          {albums.map((album) => (
            <li key={album.id}>
              <Link
                href={`/albums/${album.id}`}
                className="card-interactive flex items-center gap-3 px-4 py-3"
              >
                <AlbumCover
                  imageUrl={albumCoverSrcFromHit(album.coverUrl, album.spotifyId)}
                  fallbackColor="#262626"
                  title={album.title}
                  size="sm"
                />
                <div className="min-w-0">
                  <p className="truncate font-medium text-neutral-100">
                    {album.title}
                  </p>
                  <p className="truncate text-xs text-neutral-500">
                    <ArtistLink
                      artistId={album.artistId}
                      name={album.artistName}
                      className="text-neutral-500"
                    />
                    {" · "}
                    {album.year}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </Section>
    </div>
  );
}
