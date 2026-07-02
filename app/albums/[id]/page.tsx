import { headers } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AlbumCover } from "@/components/spotify/AlbumCover";
import { AlbumReviewForm } from "@/components/review/AlbumReviewForm";
import { TrackRatingList } from "@/components/review/TrackRatingList";
import { ArtistLink } from "@/components/artist/ArtistLink";
import { ReviewCard } from "@/components/review/ReviewCard";
import { StarRating } from "@/components/ui/StarRating";
import { isCurrentUserAdmin } from "@/lib/auth/admin";
import { getUser } from "@/lib/auth/session";
import { getAlbumById, getReleaseTypeLabel } from "@/lib/data/albums";
import { albumCoverSrc } from "@/lib/covers";
import { getArtistById } from "@/lib/data/artists";
import { getReviewReactionStates } from "@/lib/data/reactions";
import { getReviewCommentsForReviews } from "@/lib/data/review-comments";
import { getReviewsByAlbumId, getUserReviewForAlbum } from "@/lib/data/reviews";
import {
  getTrackRatingAveragesForAlbum,
  getUserTrackRatingsForAlbum,
} from "@/lib/data/track-ratings";
import { getAlbumTracksFromDb } from "@/lib/data/tracks";
import { pageTitle } from "@/lib/site";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string }>;
};

export const dynamic = "force-dynamic";

function resolveBackLink(
  fromQuery: string | undefined,
  referer: string | null,
  artistId: string,
  artistName: string,
): { href: string; label: string } {
  const cameFromArtist =
    fromQuery === "artist" ||
    (() => {
      if (!referer) return false;
      try {
        const url = new URL(referer);
        const match = url.pathname.match(/^\/artists\/([^/]+)\/?$/);
        return Boolean(match && match[1] === artistId);
      } catch {
        return false;
      }
    })();

  if (cameFromArtist) {
    const label = artistName ? `← ${artistName}` : "← アーティスト";
    return { href: `/artists/${artistId}`, label };
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
  const title = pageTitle(album.title);
  const description = `${artistName}のアルバム『${album.title}』のレビューと評価`;
  const coverUrl = albumCoverSrc(album);

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: coverUrl ? [{ url: coverUrl }] : undefined,
    },
  };
}

export default async function AlbumDetailPage({
  params,
  searchParams,
}: PageProps) {
  const { id } = await params;
  const { from } = await searchParams;
  const album = await getAlbumById(id);

  if (!album) {
    notFound();
  }

  const user = await getUser();
  const artist = await getArtistById(album.artistId);
  const artistName = artist?.name ?? "";
  const tracks = getAlbumTracksFromDb(album);

  const referer = (await headers()).get("referer");
  const backLink = resolveBackLink(from, referer, album.artistId, artistName);

  const [reviews, userReview, userTrackRatings, trackAverages, isAdmin] =
    await Promise.all([
      getReviewsByAlbumId(id),
      user ? getUserReviewForAlbum(user.id, id) : Promise.resolve(null),
      user ? getUserTrackRatingsForAlbum(user.id, id) : Promise.resolve(new Map()),
      getTrackRatingAveragesForAlbum(id),
      isCurrentUserAdmin(),
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

  return (
    <div className="page-shell">
      <Link
        href={backLink.href}
        className="link-accent mb-6 inline-block text-sm hover:underline"
      >
        {backLink.label}
      </Link>

      <div className="mb-10 flex flex-col gap-8 sm:flex-row">
        <AlbumCover
          imageUrl={albumCoverSrc(album)}
          fallbackColor={album.coverColor}
          title={album.title}
        />
        <div className="flex-1">
          <p className="text-sm text-[var(--muted)]">
            {album.year} · {getReleaseTypeLabel(album.type)} · {album.genre}
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

      <section className="mt-10">
        <h2 className="mb-4 text-lg font-semibold text-[var(--foreground)]">
          みんなのレビュー
        </h2>
        {reviews.length > 0 ? (
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
        ) : (
          <p className="text-sm text-[var(--muted)]">まだレビューはありません。</p>
        )}
      </section>
    </div>
  );
}
