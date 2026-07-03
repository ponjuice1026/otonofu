import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ReviewCard } from "@/components/review/ReviewCard";
import { DeleteThreadButton } from "@/components/thread/DeleteThreadButton";
import { ThreadPoll } from "@/components/thread/ThreadPoll";
import { ThreadPostsSection } from "@/components/thread/ThreadPostsSection";
import { isCurrentUserAdmin } from "@/lib/auth/admin";
import { ensureProfile } from "@/lib/auth/profile";
import { getUser } from "@/lib/auth/session";
import { getAlbumCoverMapForIds } from "@/lib/data/albums";
import { getDiscussionPoll } from "@/lib/data/polls";
import { canAddPollOption } from "@/lib/data/poll-participants";
import { getPostReactionStates, getReviewReactionStates } from "@/lib/data/reactions";
import { getReviewCommentCounts } from "@/lib/data/review-comments";
import {
  getDiscussionPostsByThreadId,
  getDiscussionThreadById,
} from "@/lib/data/threads";
import { getReviewForSessionThread } from "@/lib/data/reviews";
import { buildReviewCardCoverProps } from "@/lib/reviews/review-card-cover";
import { UserLink } from "@/components/user/UserLink";
import { formatThreadDate } from "@/lib/threads/format";
import { profilePostName } from "@/lib/threads/validate";
import { pageTitle, siteUrl } from "@/lib/site";

type PageProps = {
  params: Promise<{ id: string }>;
};

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps) {
  const { id } = await params;
  const thread = await getDiscussionThreadById(id);

  if (!thread) {
    return {
      title: pageTitle("セッション"),
    };
  }

  const title = pageTitle(thread.title);
  const description = thread.body
    ? thread.body.slice(0, 120)
    : `${thread.title}についてのセッション。音楽好きが集まり語り合う。`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "article",
      url: siteUrl(`/threads/${thread.id}`),
    },
    twitter: {
      card: "summary",
      title,
      description,
    },
    alternates: {
      canonical: siteUrl(`/threads/${thread.id}`),
    },
  };
}

export default async function ThreadDetailPage({ params }: PageProps) {
  const { id } = await params;

  const [thread, posts, poll, user, isAdmin] = await Promise.all([
    getDiscussionThreadById(id),
    getDiscussionPostsByThreadId(id),
    getDiscussionPoll(id),
    getUser(),
    isCurrentUserAdmin(),
  ]);

  if (!thread) {
    notFound();
  }

  if (thread.status === "draft") {
    if (thread.authorId !== user?.id && !isAdmin) {
      notFound();
    }
    redirect(`/threads/new?draft=${thread.id}`);
  }

  const canDeleteThread = isAdmin || thread.authorId === user?.id;
  const mightHaveReview = Boolean(thread.reviewId || thread.albumId);

  const [sessionReview, reactionMap, canAddOption, profile] = await Promise.all([
    mightHaveReview ? getReviewForSessionThread(thread) : Promise.resolve(null),
    getPostReactionStates(posts.map((p) => p.id)),
    poll ? canAddPollOption(thread.id, thread.authorId) : Promise.resolve(false),
    user ? ensureProfile(user.id, user.email) : Promise.resolve(null),
  ]);

  const [reviewReactions, reviewCommentCounts, albumCovers] = sessionReview
    ? await Promise.all([
        getReviewReactionStates([sessionReview.id]),
        getReviewCommentCounts([sessionReview.id]),
        getAlbumCoverMapForIds([sessionReview.albumId]),
      ])
    : [new Map(), new Map(), new Map<string, never>()];

  const defaultDisplayName = profile
    ? profilePostName(profile.display_name, profile.username)
    : null;
  const reactionStates = Object.fromEntries(reactionMap);

  const reviewCover = sessionReview
    ? buildReviewCardCoverProps(sessionReview.albumId, albumCovers)
    : null;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <Link
        href="/threads"
        className="mb-6 inline-block text-sm text-zinc-500 transition hover:text-amber-400"
      >
        ← セッション一覧
      </Link>

      {sessionReview && reviewCover ? (
        <div className="mb-8">
          <p className="mb-3 text-xs font-medium uppercase tracking-wide text-amber-400/90">
            レビューから作成されたセッション
          </p>
          <ReviewCard
            review={{ ...sessionReview, threadId: thread.id }}
            showAlbumCover
            albumCoverUrl={reviewCover.albumCoverUrl}
            albumCoverColor={reviewCover.albumCoverColor}
            reactionState={reviewReactions.get(sessionReview.id)}
            commentCount={reviewCommentCounts.get(sessionReview.id) ?? 0}
            hideSessionLink
          />
          <p className="mt-3 text-xs text-zinc-500">
            作成者{" "}
            <UserLink
              userId={thread.authorId}
              name={thread.authorName}
              className="text-zinc-400 transition hover:text-zinc-200"
            />{" "}
            · {formatThreadDate(thread.createdAt)} ·
            閲覧 {thread.viewCount.toLocaleString("ja-JP")} · 返信{" "}
            {thread.postCount}
          </p>
          {canDeleteThread && (
            <div className="mt-3">
              <DeleteThreadButton threadId={thread.id} isAdmin={isAdmin} />
            </div>
          )}
        </div>
      ) : (
        <article className="mb-8 rounded-lg border border-amber-500/30 bg-zinc-900/60 px-5 py-5">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-amber-400/90">
            セッション
          </p>
          <h1 className="text-2xl font-bold text-zinc-50">{thread.title}</h1>
          {thread.albumId && (
            <p className="mt-2 text-sm">
              <Link
                href={`/albums/${thread.albumId}`}
                className="text-amber-400 hover:underline"
              >
                アルバムページへ
              </Link>
            </p>
          )}
          <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-zinc-300">
            {thread.body}
          </p>
          <p className="mt-4 text-xs text-zinc-500">
            作成者{" "}
            <UserLink
              userId={thread.authorId}
              name={thread.authorName}
              className="text-zinc-400 transition hover:text-zinc-200"
            />{" "}
            · {formatThreadDate(thread.createdAt)} ·
            閲覧 {thread.viewCount.toLocaleString("ja-JP")} · 返信{" "}
            {thread.postCount}
          </p>
          {canDeleteThread && (
            <DeleteThreadButton threadId={thread.id} isAdmin={isAdmin} />
          )}
        </article>
      )}

      {poll && <ThreadPoll poll={poll} canAddOption={canAddOption} />}

      <ThreadPostsSection
        threadId={thread.id}
        posts={posts}
        reactionStates={reactionStates}
        isAdmin={isAdmin}
        isLoggedIn={Boolean(user)}
        defaultDisplayName={defaultDisplayName}
      />
    </div>
  );
}
