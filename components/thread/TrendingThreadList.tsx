import Link from "next/link";
import { ThreadHomeCard } from "@/components/thread/ThreadHomeCard";
import { formatThreadDate } from "@/lib/threads/format";
import { formatRankLabel, rankNumClass } from "@/lib/rank-tone";
import type { DiscussionThread } from "@/lib/types";

type TrendingThreadListProps = {
  threads: DiscussionThread[];
  variant?: "trending" | "newest";
  layout?: "list" | "row";
  showNote?: boolean;
  showRank?: boolean;
};

export function TrendingThreadList({
  threads,
  variant = "trending",
  layout = "list",
  showNote = false,
  showRank = true,
}: TrendingThreadListProps) {
  if (threads.length === 0) {
    return (
      <p className="empty-state">
        {variant === "newest"
          ? "まだセッションがありません。"
          : "まだ話題のセッションはありません。"}
      </p>
    );
  }

  if (layout === "row") {
    return (
      <ol className="thread-home-row">
        {threads.map((thread, index) => (
          <li key={thread.id} className="thread-home-row__item">
            <ThreadHomeCard
              thread={thread}
              rank={showRank ? index + 1 : undefined}
              variant={variant}
              showNote={showNote}
            />
          </li>
        ))}
      </ol>
    );
  }

  return (
    <ol className="flex flex-col gap-2">
      {threads.map((thread, index) => (
        <li key={thread.id}>
          <Link
            href={`/threads/${thread.id}`}
            className="card-interactive flex items-start gap-3 px-4 py-3.5"
          >
            <span
              className={`${rankNumClass(index + 1)} mt-0.5 w-8 shrink-0 text-center`}
              aria-label={`人気順 ${index + 1} 位`}
            >
              {formatRankLabel(index + 1)}
            </span>
            <div className="min-w-0 flex-1">
              <h3 className="line-clamp-1 font-semibold text-neutral-100">
                {thread.title}
              </h3>
              <p className="mt-1 line-clamp-1 text-sm text-neutral-500">
                {thread.body}
              </p>
              <p className="mt-2 text-xs text-neutral-500">
                <span className="text-neutral-400">{thread.authorName}</span>
                {thread.hasPoll && (
                  <span className="badge ml-2">投票</span>
                )}
                <span className="ml-2 num-stat">
                  返信 {thread.postCount} · 閲覧{" "}
                  {thread.viewCount.toLocaleString("ja-JP")}
                </span>
                <span className="ml-2 text-neutral-600">
                  ·{" "}
                  {variant === "newest"
                    ? `作成 ${formatThreadDate(thread.createdAt)}`
                    : formatThreadDate(thread.updatedAt)}
                </span>
              </p>
            </div>
          </Link>
        </li>
      ))}
    </ol>
  );
}
