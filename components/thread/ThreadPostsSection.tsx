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
  defaultDisplayName: string | null;
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
  defaultDisplayName,
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

  useEffect(() => {
    if (replyTo) {
      expandPostPath(replyTo.id);
    }
  }, [replyTo, expandPostPath]);

  const handleReplyClick = useCallback((post: DiscussionPost) => {
    setReplyTo((current) => {
      const next = current?.id === post.id ? null : post;
      if (next) {
        window.setTimeout(() => {
          const target = document.getElementById(`reply-form-${next.id}`);
          target?.scrollIntoView({ behavior: "smooth", block: "center" });
        }, 50);
      }
      return next;
    });
  }, []);

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
        <h2 className="mb-4 text-lg font-semibold text-zinc-100">
          コメント ({posts.length})
        </h2>
        <ThreadPostList
          threadId={threadId}
          posts={posts}
          reactionStates={reactionStates}
          isAdmin={isAdmin}
          isLoggedIn={isLoggedIn}
          defaultDisplayName={defaultDisplayName}
          replyToPostId={replyTo?.id ?? null}
          collapsedIds={collapsedIds}
          onReplyClick={handleReplyClick}
          onToggleReplies={handleToggleReplies}
          onCancelReply={handleCancelReply}
          onPosted={handlePosted}
        />
      </section>

      <section
        ref={formRef}
        className="rounded-lg border border-zinc-800 bg-zinc-900/40 px-5 py-5"
      >
        <h2 className="mb-4 text-lg font-semibold text-zinc-100">
          コメントを投稿
        </h2>
        <ThreadPostForm
          threadId={threadId}
          isLoggedIn={isLoggedIn}
          defaultDisplayName={defaultDisplayName}
          onPosted={handlePosted}
        />
      </section>
    </>
  );
}
