import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { logout } from "@/app/login/actions";
import { AvatarUploader } from "@/components/profile/AvatarUploader";
import { ProfileExpandableSection } from "@/components/profile/ProfileExpandableSection";
import { ProfileEditForm } from "@/components/profile/ProfileEditForm";
import { MyContributionsList } from "@/components/contribute/MyContributionsList";
import { ReviewCard } from "@/components/review/ReviewCard";
import { ensureProfile } from "@/lib/auth/profile";
import { getUser } from "@/lib/auth/session";
import { getMyContributions } from "@/lib/data/contributions";
import { getUserProfileStats } from "@/lib/data/profile-stats";
import { getReviewReactionStates } from "@/lib/data/reactions";
import { getReviewCommentCounts } from "@/lib/data/review-comments";
import { getReviewsByUserId } from "@/lib/data/reviews";
import { getDiscussionThreadsByAuthorId } from "@/lib/data/threads";
import { formatThreadDate } from "@/lib/threads/format";
import { pageTitle } from "@/lib/site";

export const metadata = {
  title: pageTitle("プロフィール"),
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

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

export default async function ProfilePage() {
  const user = await getUser();
  if (!user) redirect("/login?redirect=/profile");

  const profile = await ensureProfile(user.id, user.email);
  if (!profile) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-8">
        <h1 className="mb-4 text-2xl font-bold text-zinc-50">プロフィール</h1>
        <p className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          プロフィールの取得に失敗しました。
        </p>
      </div>
    );
  }

  const [stats, myReviews, myThreads, myContributions] = await Promise.all([
    getUserProfileStats(user.id),
    getReviewsByUserId(user.id),
    getDiscussionThreadsByAuthorId(user.id),
    getMyContributions(user.id),
  ]);

  const reviewIds = myReviews.map((r) => r.id);
  const [reviewReactions, reviewCommentCounts] = await Promise.all([
    getReviewReactionStates(reviewIds),
    getReviewCommentCounts(reviewIds),
  ]);

  const reviewReactionsRecord = Object.fromEntries(reviewReactions);
  const reviewCommentCountsRecord = Object.fromEntries(reviewCommentCounts);

  const displayName = profile.display_name?.trim() || profile.username;

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
        <div className="min-w-0">
          <h1 className="page-title">{displayName}</h1>
          <p className="text-sm text-neutral-500">@{profile.username}</p>
        </div>
      </header>

      <section className="surface-panel mb-6 px-5 py-4">
        <h2 className="mb-2 text-sm font-semibold text-neutral-300">自己紹介</h2>
        {profile.bio ? (
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-neutral-200">
            {profile.bio}
          </p>
        ) : (
          <p className="text-sm italic text-neutral-500">
            まだ自己紹介がありません。下のフォームから書いてみましょう。
          </p>
        )}
      </section>

      <section className="surface-panel mb-6 px-5 py-4">
        <h2 className="mb-3 text-sm font-semibold text-neutral-300">アクティビティ</h2>
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-[var(--radius-md)] bg-[var(--surface-raised)] px-3 py-2 ring-1 ring-[var(--border)]">
            <dt className="text-xs text-neutral-500">受け取った 👍</dt>
            <dd className="mt-1 text-xl font-bold text-emerald-300">
              {stats.receivedGoods.toLocaleString("ja-JP")}
            </dd>
          </div>
          <div className="rounded-[var(--radius-md)] bg-[var(--surface-raised)] px-3 py-2 ring-1 ring-[var(--border)]">
            <dt className="text-xs text-neutral-500">受け取った 👎</dt>
            <dd className="mt-1 text-xl font-bold text-rose-300">
              {stats.receivedBads.toLocaleString("ja-JP")}
            </dd>
          </div>
          <a
            href="#my-reviews"
            className="group rounded-[var(--radius-md)] bg-[var(--surface-raised)] px-3 py-2 ring-1 ring-[var(--border)] transition hover:bg-[var(--surface-hover)]"
          >
            <dt className="text-xs text-neutral-500 group-hover:text-neutral-300">
              書いたレビュー →
            </dt>
            <dd className="mt-1 text-xl font-bold text-neutral-100">
              {stats.reviewCount.toLocaleString("ja-JP")}
            </dd>
          </a>
          <a
            href="#my-threads"
            className="group rounded-[var(--radius-md)] bg-[var(--surface-raised)] px-3 py-2 ring-1 ring-[var(--border)] transition hover:bg-[var(--surface-hover)]"
          >
            <dt className="text-xs text-neutral-500 group-hover:text-neutral-300">
              立てたセッション →
            </dt>
            <dd className="mt-1 text-xl font-bold text-neutral-100">
              {stats.threadCount.toLocaleString("ja-JP")}
            </dd>
          </a>
        </dl>
        <div className="mt-3 flex flex-wrap gap-3 text-sm">
          <Link
            href={`/users/${user.id}/following`}
            className="link-accent hover:underline"
          >
            フォロー中 →
          </Link>
          <Link
            href={`/users/${user.id}/followers`}
            className="link-accent hover:underline"
          >
            フォロワー →
          </Link>
          <Link href="/following" className="link-accent hover:underline">
            フォロー中の新着レビュー →
          </Link>
        </div>
      </section>

      <section className="surface-panel mb-8 px-5 py-4">
        <h2 className="mb-3 text-sm font-semibold text-neutral-300">アカウント情報</h2>
        <dl className="grid grid-cols-[8rem_1fr] gap-y-2 text-sm">
          <dt className="text-neutral-500">メールアドレス</dt>
          <dd className="text-neutral-200">{user.email}</dd>
          <dt className="text-neutral-500">登録日</dt>
          <dd className="text-neutral-200">
            {formatJoinedDate(profile.created_at)}
          </dd>
          <dt className="text-neutral-500">権限</dt>
          <dd>
            {profile.is_admin ? (
              <span className="badge badge-accent">管理者</span>
            ) : (
              <span className="text-xs text-neutral-500">一般</span>
            )}
          </dd>
        </dl>
      </section>

      <section className="surface-panel mb-6 px-5 py-5">
        <h2 className="mb-4 section-title">アバター</h2>
        <AvatarUploader
          currentAvatarUrl={profile.avatar_url}
          displayName={displayName}
        />
      </section>

      <section className="surface-panel mb-8 px-5 py-5">
        <h2 className="mb-4 section-title">編集</h2>
        <ProfileEditForm
          initialDisplayName={profile.display_name ?? ""}
          initialUsername={profile.username}
          initialBio={profile.bio ?? ""}
        />
      </section>

      <ProfileExpandableSection
        id="my-reviews"
        title="書いたレビュー"
        count={myReviews.length}
      >
        {myReviews.length > 0 ? (
          <div className="flex flex-col gap-4">
            {myReviews.map((review) => (
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
            まだレビューを書いていません。アルバムページから評価してみましょう。
          </p>
        )}
      </ProfileExpandableSection>

      <ProfileExpandableSection
        id="my-threads"
        title="立てたセッション"
        count={myThreads.length}
      >
        {myThreads.length > 0 ? (
          <ul className="flex flex-col gap-2">
            {myThreads.map((thread) => (
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
                    {thread.hasPoll && (
                      <span className="badge mr-2">投票</span>
                    )}
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
            <Link href="/threads/new" className="link-accent ml-1 hover:underline">
              新しいセッションを作成 →
            </Link>
          </p>
        )}
      </ProfileExpandableSection>

      <ProfileExpandableSection
        id="my-contributions"
        title="データ申請"
        count={myContributions.length}
      >
        <MyContributionsList contributions={myContributions} />
      </ProfileExpandableSection>

      <footer className="mt-10 border-t border-[var(--border)] pt-8 pb-4">
        <form action={logout}>
          <button type="submit" className="btn-secondary w-full">
            ログアウト
          </button>
        </form>
      </footer>
    </div>
  );
}
