"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ThreadPostForm } from "@/components/thread/ThreadPostForm";
import { ThreadPostList } from "@/components/thread/ThreadPostList";
import {
  buildInitialCollapsedIds,
  collectSubtreeCollapsibleIds,
  collectSubtreeCollapsibleIdsForPost,
  type DiscussionPostNode,
} from "@/lib/threads/post-tree";
import type { DiscussionPost, ReactionState } from "@/lib/types";

type ThreadPostsSectionProps = {
  threadId: string;
  posts: DiscussionPost[];
  reactionStates: Record<string, ReactionState>;
  isAdmin: boolean;
  isLoggedIn: boolean;
  /** 閲覧者のユーザーID。自分のレスの削除ボタン表示判定に使う（未ログインは null）。 */
  currentUserId: string | null;
  defaultDisplayName: string | null;
  /** スレ全体のコメント数（ページ跨ぎの総数）。未指定なら表示中の件数。 */
  totalPostCount?: number;
  /** スレが凍結中か（監査 D-3）。凍結中は投稿フォームを隠す。 */
  isLocked?: boolean;
};

function collectAncestorIds(
  posts: DiscussionPost[],
  targetId: string,
): string[] {
  const parentById = new Map(posts.map((post) => [post.id, post.parentPostId]));
  const ancestors: string[] = [];
  let current = parentById.get(targetId) ?? null;

  while (current) {
    ancestors.push(current);
    current = parentById.get(current) ?? null;
  }

  return ancestors;
}

export function ThreadPostsSection({
  threadId,
  posts,
  reactionStates,
  isAdmin,
  isLoggedIn,
  currentUserId,
  defaultDisplayName,
  totalPostCount,
  isLocked = false,
}: ThreadPostsSectionProps) {
  const [replyTo, setReplyTo] = useState<DiscussionPost | null>(null);
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(() =>
    buildInitialCollapsedIds(posts),
  );
  const formRef = useRef<HTMLDivElement>(null);
  const threadIdRef = useRef(threadId);

  useEffect(() => {
    if (threadIdRef.current === threadId) return;
    threadIdRef.current = threadId;
    setCollapsedIds(buildInitialCollapsedIds(posts));
    setReplyTo(null);
  }, [threadId, posts]);

  const expandPostPath = useCallback(
    (postId: string) => {
      const idsOnPath = [postId, ...collectAncestorIds(posts, postId)];
      setCollapsedIds((current) => {
        const next = new Set(current);
        for (const id of idsOnPath) {
          for (const collapsibleId of collectSubtreeCollapsibleIdsForPost(
            posts,
            id,
          )) {
            next.delete(collapsibleId);
          }
        }
        return next;
      });
    },
    [posts],
  );

  const handleReplyClick = useCallback(
    (post: DiscussionPost) => {
      const isOpening = replyTo?.id !== post.id;
      setReplyTo(isOpening ? post : null);
      if (isOpening) {
        expandPostPath(post.id);
        window.setTimeout(() => {
          const target = document.getElementById(`reply-form-${post.id}`);
          target?.scrollIntoView({ behavior: "smooth", block: "center" });
        }, 50);
      }
    },
    [replyTo, expandPostPath],
  );

  const handleJumpToPost = useCallback(
    (postId: string) => {
      expandPostPath(postId);
      window.setTimeout(() => {
        const target = document.getElementById(`post-${postId}`);
        if (!target) return;
        target.scrollIntoView({ behavior: "smooth", block: "center" });
        target.classList.add("reddit-comment--highlight");
        window.setTimeout(() => {
          target.classList.remove("reddit-comment--highlight");
        }, 1500);
      }, 50);
    },
    [expandPostPath],
  );

  useEffect(() => {
    const hash = window.location.hash;
    if (!hash.startsWith("#post-")) return;
    const postId = hash.slice("#post-".length);
    if (!postId) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reads the URL hash on mount to jump to a post; not a derived-state sync
    handleJumpToPost(postId);
  }, [posts, handleJumpToPost]);

  const handleToggleReplies = useCallback((node: DiscussionPostNode) => {
    const subtreeIds = collectSubtreeCollapsibleIds(node);
    setCollapsedIds((current) => {
      const next = new Set(current);
      const isHidden = current.has(node.id);
      if (isHidden) {
        for (const id of subtreeIds) {
          next.delete(id);
        }
      } else {
        for (const id of subtreeIds) {
          next.add(id);
        }
      }
      return next;
    });
  }, []);

  const handlePosted = useCallback(() => {
    setReplyTo((current) => {
      if (current) {
        setCollapsedIds((prev) => {
          const next = new Set(prev);
          for (const id of collectSubtreeCollapsibleIdsForPost(
            posts,
            current.id,
          )) {
            next.delete(id);
          }
          return next;
        });
      }
      return null;
    });
  }, [posts]);

  const handleCancelReply = useCallback(() => {
    setReplyTo(null);
  }, []);

  return (
    <>
      <section className="mb-10">
        <h2 className="mb-4 text-lg font-semibold text-[var(--foreground)]">
          コメント ({(totalPostCount ?? posts.length).toLocaleString("ja-JP")})
        </h2>
        <ThreadPostList
          threadId={threadId}
          posts={posts}
          reactionStates={reactionStates}
          isAdmin={isAdmin}
          isLoggedIn={isLoggedIn}
          currentUserId={currentUserId}
          defaultDisplayName={defaultDisplayName}
          replyToPostId={replyTo?.id ?? null}
          collapsedIds={collapsedIds}
          onReplyClick={handleReplyClick}
          onToggleReplies={handleToggleReplies}
          onCancelReply={handleCancelReply}
          onPosted={handlePosted}
          isLocked={isLocked}
        />
      </section>

      <section
        ref={formRef}
        className="rounded-lg border border-[var(--border)] bg-[var(--surface-raised)] px-5 py-5"
      >
        <h2 className="mb-4 text-lg font-semibold text-[var(--foreground)]">
          コメントを投稿
        </h2>
        {isLocked ? (
          <p className="alert alert-warning text-sm">
            このセッションは凍結されています。新規の投稿・返信・投票はできません。
          </p>
        ) : (
          <ThreadPostForm
            threadId={threadId}
            isLoggedIn={isLoggedIn}
            defaultDisplayName={defaultDisplayName}
            onPosted={handlePosted}
          />
        )}
      </section>
    </>
  );
}
