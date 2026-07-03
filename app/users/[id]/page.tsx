import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ProfileExpandableSection } from "@/components/profile/ProfileExpandableSection";
import { ReviewCard } from "@/components/review/ReviewCard";
import { getProfile } from "@/lib/auth/profile";
import { getUserProfileStats } from "@/lib/data/profile-stats";
import { getFollowCounts, isFollowing } from "@/lib/data/follows";
import { FollowButton } from "@/components/profile/FollowButton";
import { getReviewReactionStates } from "@/lib/data/reactions";
import { getReviewCommentCounts } from "@/lib/data/review-comments";
import { getReviewsByUserId } from "@/lib/data/reviews";
import { getListsByAuthorId } from "@/lib/data/lists";
import { getUser } from "@/lib/auth/session";
import { ListCoverCollage } from "@/components/list/ListCoverCollage";
import { getDiscussionThreadsByAuthorId } from "@/lib/data/threads";
import { formatThreadDate } from "@/lib/threads/format";
import { pageTitle } from "@/lib/site";

type PageProps = {
  params: Promise<{ id: string }>;
};

export const dynamic = "force-dynamic";

function profileDisplayName(profile: {
  display_name: string | null;
  username: string;
}): string {
  return profile.display_name?.trim() || profile.username;
}

function formatJoinedDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function initialFor(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "?";
  const cp = trimmed.codePointAt(0);
  return cp ? String.fromCodePoint(cp) : "?";
}

export async function generateMetadata({ params }: PageProps) {
  const { id } = await params;
  const profile = await getProfile(id);

  if (!profile) {
    return {
      title: pageTitle("ユーザー"),
    };
  }

  const displayName = profileDisplayName(profile);
  const title = pageTitle(displayName);
  const description = profile.bio?.trim()
    ? profile.bio.trim().slice(0, 120)
    : `${displayName} のレビュー・セッションをチェックできる。`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: profile.avatar_url ? [{ url: profile.avatar_url }] : undefined,
    },
  };
}

export default async function PublicUserPage({ params }: PageProps) {
  const { id } = await params;
  const profile = await getProfile(id);

  if (!profile) {
    notFound();
  }

  const viewer = await getUser();
  const isOwner = Boolean(viewer && viewer.id === id);

  const [stats, reviews, threads, lists, followCounts, viewerFollows] =
    await Promise.all([
      getUserProfileStats(id),
      getReviewsByUserId(id),
      getDiscussionThreadsByAuthorId(id),
      getListsByAuthorId(id, isOwner),
      getFollowCounts(id),
      viewer && !isOwner
        ? isFollowing(viewer.id, id)
        : Promise.resolve(false),
    ]);

  const reviewIds = reviews.map((r) => r.id);
  const [reviewReactions, reviewCommentCounts] = await Promise.all([
    getReviewReactionStates(reviewIds),
    getReviewCommentCounts(reviewIds),
  ]);

  const reviewReactionsRecord = Object.fromEntries(reviewReactions);
  const reviewCommentCountsRecord = Object.fromEntries(reviewCommentCounts);

  const displayName = profileDisplayName(profile);

  const avgRating =
    reviews.length > 0
      ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
      : null;

  return (
    <div className="page-shell mx-auto max-w-2xl">
      <header className="page-header flex items-center gap-4">
        <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-full border border-[var(--border-strong)] bg-[var(--surface-raised)] ring-1 ring-[var(--border)]">
          {profile.avatar_url ? (
            <Image
              src={profile.avatar_url}
              alt={displayName}
              fill
              className="object-cover"
              sizes="64px"
              unoptimized
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-2xl font-bold text-zinc-400">
              {initialFor(displayName)}
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="page-title">{displayName}</h1>
          <p className="text-sm text-neutral-500">@{profile.username}</p>
          <div className="mt-2 flex items-center gap-4 text-sm">
            <Link
              href={`/users/${id}/following`}
              className="text-neutral-400 transition hover:text-neutral-100"
            >
              <span className="font-bold text-neutral-100">
                {followCounts.following.toLocaleString("ja-JP")}
              </span>{" "}
              フォロー中
            </Link>
            <Link
              href={`/users/${id}/followers`}
              className="text-neutral-400 transition hover:text-neutral-100"
            >
              <span className="font-bold text-neutral-100">
                {followCounts.followers.toLocaleString("ja-JP")}
              </span>{" "}
              フォロワー
            </Link>
          </div>
        </div>
        {!isOwner &&
          (viewer ? (
            <FollowButton targetId={id} initialFollowing={viewerFollows} />
          ) : (
            <Link
              href={`/login?redirect=/users/${id}`}
              className="btn-primary text-sm"
            >
              フォローする
            </Link>
          ))}
      </header>

      <section className="surface-panel mb-6 px-5 py-4">
        <h2 className="mb-2 text-sm font-semibold text-neutral-300">自己紹介</h2>
        {profile.bio?.trim() ? (
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-neutral-200">
            {profile.bio}
          </p>
        ) : (
          <p className="text-sm italic text-neutral-500">
            自己紹介はまだありません。
          </p>
        )}
      </section>

      <section className="surface-panel mb-6 px-5 py-4">
        <h2 className="mb-3 text-sm font-semibold text-neutral-300">統計</h2>
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <a
            href="#user-reviews"
            className="group rounded-[var(--radius-md)] bg-[var(--surface-raised)] px-3 py-2 ring-1 ring-[var(--border)] transition hover:bg-[var(--surface-hover)]"
          >
            <dt className="text-xs text-neutral-500 group-hover:text-neutral-300">
              レビュー数 →
            </dt>
            <dd className="mt-1 text-xl font-bold text-neutral-100">
              {stats.reviewCount.toLocaleString("ja-JP")}
            </dd>
          </a>
          <div className="rounded-[var(--radius-md)] bg-[var(--surface-raised)] px-3 py-2 ring-1 ring-[var(--border)]">
            <dt className="text-xs text-neutral-500">平均評価</dt>
            <dd className="mt-1 text-xl font-bold text-amber-300">
              {avgRating !== null ? avgRating.toFixed(1) : "—"}
            </dd>
          </div>
          <a
            href="#user-threads"
            className="group rounded-[var(--radius-md)] bg-[var(--surface-raised)] px-3 py-2 ring-1 ring-[var(--border)] transition hover:bg-[var(--surface-hover)]"
          >
            <dt className="text-xs text-neutral-500 group-hover:text-neutral-300">
              セッション数 →
            </dt>
            <dd className="mt-1 text-xl font-bold text-neutral-100">
              {stats.threadCount.toLocaleString("ja-JP")}
            </dd>
          </a>
          <div className="rounded-[var(--radius-md)] bg-[var(--surface-raised)] px-3 py-2 ring-1 ring-[var(--border)]">
            <dt className="text-xs text-neutral-500">参加日</dt>
            <dd className="mt-1 text-sm font-semibold text-neutral-200">
              {formatJoinedDate(profile.created_at)}
            </dd>
          </div>
        </dl>
      </section>

      <ProfileExpandableSection
        id="user-reviews"
        title="レビュー"
        count={reviews.length}
      >
        {reviews.length > 0 ? (
          <div className="flex flex-col gap-4">
            {reviews.map((review) => (
              <ReviewCard
                key={review.id}
                review={review}
                reactionState={reviewReactionsRecord[review.id]}
                commentCount={reviewCommentCountsRecord[review.id] ?? 0}
              />
            ))}
          </div>
        ) : (
          <p className="text-sm text-neutral-500">
            まだレビューがありません。
          </p>
        )}
      </ProfileExpandableSection>

      <ProfileExpandableSection
        id="user-threads"
        title="立てたセッション"
        count={threads.length}
      >
        {threads.length > 0 ? (
          <ul className="flex flex-col gap-2">
            {threads.map((thread) => (
              <li key={thread.id}>
                <Link
                  href={`/threads/${thread.id}`}
                  className="card-interactive block px-4 py-3"
                >
                  <h3 className="line-clamp-1 font-semibold text-neutral-100">
                    {thread.title}
                  </h3>
                  <p className="mt-1 line-clamp-1 text-sm text-neutral-500">
                    {thread.body}
                  </p>
                  <p className="mt-2 text-xs text-neutral-500">
                    {thread.hasPoll && <span className="badge mr-2">投票</span>}
                    閲覧 {thread.viewCount.toLocaleString("ja-JP")} · 返信{" "}
                    {thread.postCount} · 作成{" "}
                    {formatThreadDate(thread.createdAt)}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-neutral-500">
            まだセッションを立てていません。
          </p>
        )}
      </ProfileExpandableSection>

      <ProfileExpandableSection
        id="user-lists"
        title="リスト"
        count={lists.length}
      >
        {lists.length > 0 ? (
          <ul className="flex flex-col gap-3">
            {lists.map((list) => (
              <li key={list.id}>
                <Link
                  href={`/lists/${list.id}`}
                  className="card-interactive flex gap-3 p-3"
                >
                  <div className="w-16 shrink-0">
                    <ListCoverCollage items={list.coverItems} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="line-clamp-1 font-semibold text-neutral-100">
                      {list.title}
                      {!list.isPublic && (
                        <span className="ml-2 align-middle text-xs text-neutral-500">
                          (非公開)
                        </span>
                      )}
                    </h3>
                    <p className="mt-1 text-xs text-neutral-500">
                      {list.itemCount.toLocaleString("ja-JP")} 枚
                    </p>
                    {list.description && (
                      <p className="mt-1 line-clamp-1 text-sm text-neutral-500">
                        {list.description}
                      </p>
                    )}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-neutral-500">
            まだリストがありません。
          </p>
        )}
      </ProfileExpandableSection>
    </div>
  );
}
