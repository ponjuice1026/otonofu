import Link from "next/link";
import { formatThreadDate } from "@/lib/threads/format";
import { formatRankLabel, rankNumClass } from "@/lib/rank-tone";
import type { DiscussionThread } from "@/lib/types";

type ThreadHomeCardProps = {
  thread: DiscussionThread & { matchReason?: string };
  rank?: number;
  variant?: "trending" | "newest";
  featured?: boolean;
  showNote?: boolean;
};

export function ThreadHomeCard({
  thread,
  rank,
  variant = "trending",
  featured = false,
  showNote = false,
}: ThreadHomeCardProps) {
  return (
    <Link
      href={`/threads/${thread.id}`}
      className={
        featured
          ? "thread-home-card thread-home-card-featured"
          : "thread-home-card card-interactive"
      }
    >
      <div className="thread-home-card__head">
        {rank !== undefined ? (
          <span
            className={`${rankNumClass(rank)} thread-home-card__rank`}
            aria-label={`人気順 ${rank} 位`}
          >
            {formatRankLabel(rank)}
          </span>
        ) : featured ? (
          <span className="thread-home-card__badge" aria-hidden="true">
            ★
          </span>
        ) : null}
        {thread.kind === "album" && (
          <span className="badge badge-muted text-[0.6875rem] opacity-75">
            アルバム
          </span>
        )}
        {thread.hasPoll && <span className="badge">投票</span>}
      </div>

      {thread.matchReason && (
        <p className="thread-home-card__reason">{thread.matchReason}</p>
      )}

      {showNote && thread.featuredNote && (
        <p className="thread-home-card__reason">&quot;{thread.featuredNote}&quot;</p>
      )}

      <h3 className="thread-home-card__title">{thread.title}</h3>
      <p className="thread-home-card__body">{thread.body}</p>

      <p className="thread-home-card__meta">
        <span className="text-neutral-400">{thread.authorName}</span>
        <span className="num-stat">
          返信 {thread.postCount} · 閲覧{" "}
          {thread.viewCount.toLocaleString("ja-JP")}
        </span>
        <span className="text-neutral-600">
          {variant === "newest"
            ? `作成 ${formatThreadDate(thread.createdAt)}`
            : formatThreadDate(thread.updatedAt)}
        </span>
      </p>
    </Link>
  );
}
