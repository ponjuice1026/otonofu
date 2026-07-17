import { headers } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AlbumCover } from "@/components/spotify/AlbumCover";
import { AlbumReviewForm } from "@/components/review/AlbumReviewForm";
import { AddToListDropdown } from "@/components/list/AddToListDropdown";
import { TrackRatingList } from "@/components/review/TrackRatingList";
import { ArtistLink } from "@/components/artist/ArtistLink";
import { ReviewCard } from "@/components/review/ReviewCard";
import { ReviewSortTabs } from "@/components/review/ReviewSortTabs";
import { ReviewsPagination } from "@/components/review/ReviewsPagination";
import { ShareButton } from "@/components/ui/ShareButton";
import { StarRating } from "@/components/ui/StarRating";
import { isCurrentUserAdmin } from "@/lib/auth/admin";
import { getUser } from "@/lib/auth/session";
import { getAlbumById, getReleaseTypeLabel } from "@/lib/data/albums";
import { findGenreForLabel } from "@/lib/genres";
import { albumCoverSrc } from "@/lib/covers";
import { getArtistById } from "@/lib/data/artists";
import { getReviewReactionStates } from "@/lib/data/reactions";
import { getReviewCommentsForReviews } from "@/lib/data/review-comments";
import {
  getReviewCountByAlbumId,
  getReviewsByAlbumId,
  getUserReviewForAlbum,
} from "@/lib/data/reviews";
import { getOwnListsForAlbum } from "@/lib/data/lists";
import { parseReviewPage, parseReviewSort } from "@/lib/reviews/review-sort";
import {
  getTrackRatingAveragesForAlbum,
  getUserTrackRatingsForAlbum,
} from "@/lib/data/track-ratings";
import { getAlbumTracksFromDb } from "@/lib/data/tracks";
import { pageTitle, siteUrl } from "@/lib/site";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    from?: string;
    reviewSort?: string;
    reviewPage?: string;
  }>;
};

export const dynamic = "force-dynamic";

function resolveBackLink(
  fromQuery: string | undefined,
  referer: string | null,
  artistId: string,
  artistName: string,
): { href: string; label: string } {
  let refererPath: string | null = null;
  if (referer) {
    try {
      refererPath = new URL(referer).pathname;
    } catch {
      refererPath = null;
    }
  }

  const cameFromArtist =
    fromQuery === "artist" ||
    (refererPath !== null &&
      (() => {
        const match = refererPath!.match(/^\/artists\/([^/]+)\/?$/);
        return Boolean(match && match[1] === artistId);
      })());

  if (cameFromArtist) {
    const label = artistName ? `← ${artistName}` : "← アーティスト";
    return { href: `/artists/${artistId}`, label };
  }

  const cameFromHome =
    fromQuery === "home" || (refererPath !== null && refererPath === "/");

  if (cameFromHome) {
    return { href: "/", label: "← ホーム" };
  }

  return { href: "/albums", label: "← アルバム一覧" };
}

export async function generateMetadata({
  params,
}: Pick<PageProps, "params">) {
  const { id } = await params;
  const album = await getAlbumById(id);

  if (!album) {
    return {
      title: pageTitle("アルバム"),
    };
  }

  const artist = await getArtistById(album.artistId);
  const artistName = artist?.name ?? "";
  const title = pageTitle(
    artistName
      ? `${album.title} - ${artistName} のレビュー・評価`
      : `${album.title} のレビュー・評価`,
  );
  const ratingText =
    album.ratingCount > 0
      ? `平均評価 ${album.avgRating.toFixed(1)}/10・${album.ratingCount.toLocaleString("ja-JP")}件のレビュー。`
      : "まだレビューはありません。";
  const description = `${artistName ? `${artistName}の` : ""}アルバム『${album.title}』のレビューと評価。${ratingText}オトノフで感想を共有しよう。`;

  // OG/Twitter 画像は同ルートの opengraph-image.tsx（動的カード）が自動供給する。
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "music.album",
      url: siteUrl(`/albums/${album.id}`),
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
    alternates: {
      canonical: siteUrl(`/albums/${album.id}`),
    },
  };
}

export default async function AlbumDetailPage({
  params,
  searchParams,
}: PageProps) {
  const { id } = await params;
  const {
    from,
    reviewSort: reviewSortParam,
    reviewPage: reviewPageParam,
  } = await searchParams;
  const album = await getAlbumById(id);

  if (!album) {
    notFound();
  }

  const reviewSort = parseReviewSort(reviewSortParam);
  const reviewPage = parseReviewPage(reviewPageParam);
  const user = await getUser();
  const artist = await getArtistById(album.artistId);
  const artistName = artist?.name ?? "";
  const tracks = getAlbumTracksFromDb(album);

  const referer = (await headers()).get("referer");
  const backLink = resolveBackLink(from, referer, album.artistId, artistName);

  const [
    reviews,
    reviewCount,
    userReview,
    userTrackRatings,
    trackAverages,
    isAdmin,
    ownLists,
  ] = await Promise.all([
    getReviewsByAlbumId(id, reviewSort, reviewPage),
    getReviewCountByAlbumId(id),
    user ? getUserReviewForAlbum(user.id, id) : Promise.resolve(null),
    user ? getUserTrackRatingsForAlbum(user.id, id) : Promise.resolve(new Map()),
    getTrackRatingAveragesForAlbum(id),
    isCurrentUserAdmin(),
    user ? getOwnListsForAlbum(user.id, id) : Promise.resolve([]),
  ]);

  const reviewIds = reviews.map((r) => r.id);
  const [reactionMap, commentsByReview] = await Promise.all([
    getReviewReactionStates(reviewIds),
    getReviewCommentsForReviews(reviewIds),
  ]);

  const spotifyUrl = album.spotifyId
    ? `https://open.spotify.com/album/${album.spotifyId}`
    : null;

  const userRatingsObject = Object.fromEntries(userTrackRatings);
  const communityAveragesObject = Object.fromEntries(trackAverages);

  const coverUrl = albumCoverSrc(album);
  const absoluteCover = coverUrl
    ? coverUrl.startsWith("http")
      ? coverUrl
      : siteUrl(coverUrl)
    : undefined;

  const albumJsonLd = {
    "@context": "https://schema.org",
    "@type": "MusicAlbum",
    name: album.title,
    url: siteUrl(`/albums/${album.id}`),
    ...(absoluteCover ? { image: absoluteCover } : {}),
    ...(artistName
      ? {
          byArtist: {
            "@type": "MusicGroup",
            name: artistName,
            "@id": siteUrl(`/artists/${album.artistId}`),
            url: siteUrl(`/artists/${album.artistId}`),
          },
        }
      : {}),
    datePublished: String(album.year),
    genre: album.genre,
    ...(album.ratingCount > 0
      ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: album.avgRating.toFixed(1),
            bestRating: 10,
            worstRating: 0,
            ratingCount: album.ratingCount,
          },
        }
      : {}),
  };

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "ホーム", item: siteUrl("/") },
      {
        "@type": "ListItem",
        position: 2,
        name: "アルバム",
        item: siteUrl("/albums"),
      },
      {
        "@type": "ListItem",
        position: 3,
        name: album.title,
        item: siteUrl(`/albums/${album.id}`),
      },
    ],
  };

  return (
    <div className="page-shell">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(albumJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <Link
        href={backLink.href}
        className="link-accent mb-6 inline-block text-sm hover:underline"
      >
        {backLink.label}
      </Link>

      <div className="mb-10 flex flex-col gap-8 sm:flex-row">
        <div className="mx-auto w-full max-w-[260px] sm:mx-0 sm:w-auto sm:max-w-none">
          <AlbumCover
            imageUrl={albumCoverSrc(album)}
            fallbackColor={album.coverColor}
            title={album.title}
            size="hero"
          />
        </div>
        <div className="flex-1">
          <p className="text-sm text-[var(--muted)]">
            {album.year} · {getReleaseTypeLabel(album.type)} ·{" "}
            {(() => {
              const genre = findGenreForLabel(album.genre);
              return genre ? (
                <Link
                  href={`/genres/${genre.slug}`}
                  className="link-accent hover:underline"
                >
                  {album.genre}
                </Link>
              ) : (
                album.genre
              );
            })()}
            {tracks.length > 0 ? ` · ${tracks.length} 曲` : ""}
          </p>
          <h1 className="mt-1 text-3xl font-bold text-[var(--foreground)]">{album.title}</h1>
          <p className="mt-2 text-xl text-[var(--muted-foreground)]">
            <ArtistLink
              artistId={album.artistId}
              name={artistName || undefined}
              className="text-[var(--muted-foreground)]"
            />
          </p>
          <div className="mt-4 flex flex-col gap-2">
            <div className="flex items-center gap-3">
              <StarRating value={album.avgRating} showBar size="lg" />
              <span className="text-sm text-[var(--muted)]">
                平均 · {album.ratingCount.toLocaleString("ja-JP")} 件の評価
              </span>
            </div>
          </div>
          {spotifyUrl && (
            <a
              href={spotifyUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="link-accent mt-4 inline-block text-sm hover:underline"
            >
              Spotify で開く →
            </a>
          )}

          <div className="mt-2">
            <ShareButton
              url={`/albums/${album.id}`}
              title={`${album.title} - ${artistName}`}
            />
          </div>

          <div className="mt-4">
            <AddToListDropdown
              albumId={album.id}
              isLoggedIn={Boolean(user)}
              lists={ownLists}
            />
          </div>

          <Link
            href={`/contribute?type=fix&album=${album.id}`}
            className="mt-3 inline-block text-xs text-[var(--muted)] hover:text-amber-300 hover:underline"
          >
            このアルバムの情報の修正を依頼 →
          </Link>

          <AlbumReviewForm
            albumId={album.id}
            isLoggedIn={Boolean(user)}
            existingReview={userReview}
          />
        </div>
      </div>

      {tracks.length > 0 ? (
        <TrackRatingList
          albumId={album.id}
          tracks={tracks}
          spotifyUrl={spotifyUrl}
          isLoggedIn={Boolean(user)}
          userRatings={userRatingsObject}
          communityAverages={communityAveragesObject}
        />
      ) : (
        <section className="mt-10">
          <h2 className="mb-4 text-lg font-semibold text-[var(--foreground)]">収録曲</h2>
          <p className="text-sm text-[var(--muted)]">
            収録曲情報はまだ登録されていません。しばらくしてから再度お試しください。
          </p>
        </section>
      )}

      <section id="reviews" className="mt-10 scroll-mt-8">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-[var(--foreground)]">
            みんなのレビュー
            {reviewCount > 0 && (
              <span className="ml-2 text-sm font-normal text-[var(--muted)]">
                （全{reviewCount.toLocaleString("ja-JP")}件）
              </span>
            )}
          </h2>
          {reviewCount > 0 && (
            <ReviewSortTabs albumId={album.id} sort={reviewSort} />
          )}
        </div>
        {reviewCount > 0 ? (
          reviews.length > 0 ? (
            <>
              <div className="flex flex-col gap-4">
                {reviews.map((review) => (
                  <div key={review.id} id={`review-${review.id}`}>
                    <ReviewCard
                      review={review}
                      showAlbumTitle={false}
                      reactionState={reactionMap.get(review.id)}
                      comments={commentsByReview.get(review.id) ?? []}
                      currentUserId={user?.id ?? null}
                      isAdmin={isAdmin}
                    />
                  </div>
                ))}
              </div>
              <ReviewsPagination
                albumId={album.id}
                currentPage={reviewPage}
                totalCount={reviewCount}
                sort={reviewSort}
              />
            </>
          ) : (
            <p className="text-sm text-[var(--muted)]">
              このページに表示できるレビューはありません。
            </p>
          )
        ) : (
          <p className="text-sm text-[var(--muted)]">まだレビューはありません。</p>
        )}
      </section>
    </div>
  );
}
