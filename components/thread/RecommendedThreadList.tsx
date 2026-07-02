import { HomeThreadFeed } from "@/components/thread/HomeThreadFeed";
import type { ReactionState, Review } from "@/lib/types";
import type { RecommendedThread } from "@/lib/data/threads";

type AlbumCoverInfo = {
  coverUrl?: string;
  spotifyId?: string;
  coverColor?: string;
};

type RecommendedThreadListProps = {
  threads: RecommendedThread[];
  reviewSessions?: Review[];
  albumCovers?: Map<string, AlbumCoverInfo>;
  reviewReactions?: Map<string, ReactionState>;
  reviewCommentCounts?: Map<string, number>;
};

export function RecommendedThreadList({
  threads,
  reviewSessions = [],
  albumCovers = new Map(),
  reviewReactions = new Map(),
  reviewCommentCounts = new Map(),
}: RecommendedThreadListProps) {
  if (threads.length === 0) return null;

  return (
    <HomeThreadFeed
      threads={threads}
      reviewSessions={reviewSessions}
      variant="trending"
      layout="row"
      albumCovers={albumCovers}
      reviewReactions={reviewReactions}
      reviewCommentCounts={reviewCommentCounts}
    />
  );
}
