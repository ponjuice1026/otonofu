"use client";

import { useMemo } from "react";
import { ReactionButtons } from "@/components/reactions/ReactionButtons";
import { ReportButton } from "@/components/report/ReportButton";
import { DeletePostButton } from "@/components/thread/DeletePostButton";
import { ThreadPostForm } from "@/components/thread/ThreadPostForm";
import { ExpandableText } from "@/components/ui/ExpandableText";
import { formatThreadDate } from "@/lib/threads/format";
import {
  buildDiscussionPostTree,
  countDiscussionPostDescendants,
  REDDIT_MAX_INDENT_DEPTH,
  type DiscussionPostNode,
} from "@/lib/threads/post-tree";
import type { DiscussionPost, ReactionState } from "@/lib/types";

type ThreadPostListProps = {
  threadId: string;
  posts: DiscussionPost[];
  reactionStates: Record<string, ReactionState>;
  isAdmin?: boolean;
  isLoggedIn: boolean;
  defaultDisplayName: string | null;
  replyToPostId: string | null;
  collapsedIds: Set<string>;
  onReplyClick: (post: DiscussionPost) => void;
  onToggleReplies: (node: DiscussionPostNode) => void;
  onCancelReply: () => void;
  onPosted: () => void;
};

const EMPTY_REACTION: ReactionState = { good: 0, bad: 0, userReaction: null };

type RedditCommentItemProps = {
  threadId: string;
  node: DiscussionPostNode;
  depth: number;
  reactionStates: Record<string, ReactionState>;
  isAdmin: boolean;
  isLoggedIn: boolean;
  defaultDisplayName: string | null;
  replyToPostId: string | null;
  collapsedIds: Set<string>;
  onReplyClick: (post: DiscussionPost) => void;
  onToggleReplies: (node: DiscussionPostNode) => void;
  onCancelReply: () => void;
  onPosted: () => void;
};

function RedditCommentItem({
  threadId,
  node,
  depth,
  reactionStates,
  isAdmin,
  isLoggedIn,
  defaultDisplayName,
  replyToPostId,
  collapsedIds,
  onReplyClick,
  onToggleReplies,
  onCancelReply,
  onPosted,
}: RedditCommentItemProps) {
  const isReplyTarget = replyToPostId === node.id;
  const repliesHidden = collapsedIds.has(node.id);
  const descendantCount = countDiscussionPostDescendants(node);
  const hasChildren = node.children.length > 0;
  const atIndentCap = depth >= REDDIT_MAX_INDENT_DEPTH;

  return (
    <div
      id={`post-${node.id}`}
      className={`reddit-comment scroll-mt-4${isReplyTarget ? " reddit-comment--reply-target" : ""}`}
    >
      <div className="reddit-comment__header">
        <span className="reddit-comment__author">{node.anonymousName}</span>
        <time dateTime={node.createdAt} className="reddit-comment__time">
          {formatThreadDate(node.createdAt)}
        </time>
        {isAdmin && <DeletePostButton postId={node.id} />}
      </div>

      <ExpandableText
        text={node.body}
        className="reddit-comment__body text-sm leading-relaxed text-zinc-100"
      />

      <div className="reddit-comment__toolbar">
        <button
          type="button"
          onClick={() => onReplyClick(node)}
          className="reddit-comment__toolbar-action"
        >
          {isReplyTarget ? "キャンセル" : "返信"}
        </button>
        <ReportButton
          targetType="discussion_post"
          targetId={node.id}
          className="reddit-comment__toolbar-action"
        />
        <div className="reddit-comment__reactions">
          <ReactionButtons
            target={{ type: "post", postId: node.id, threadId }}
            state={reactionStates[node.id] ?? EMPTY_REACTION}
          />
        </div>
      </div>

      {isReplyTarget && (
        <div
          id={`reply-form-${node.id}`}
          className="reddit-comment__reply-form scroll-mt-24"
        >
          <ThreadPostForm
            threadId={threadId}
            variant="inline"
            replyToPostId={node.id}
            replyToName={node.anonymousName}
            isLoggedIn={isLoggedIn}
            defaultDisplayName={defaultDisplayName}
            onCancelReply={onCancelReply}
            onPosted={onPosted}
          />
        </div>
      )}

      {hasChildren && repliesHidden && (
        <button
          type="button"
          onClick={() => onToggleReplies(node)}
          className="reddit-comment__show-replies"
        >
          返信 {descendantCount} 件を表示
        </button>
      )}

      {hasChildren && !repliesHidden && (
        <>
          <button
            type="button"
            onClick={() => onToggleReplies(node)}
            className="reddit-comment__hide-replies"
          >
            返信を隠す
          </button>
          <div
            className={`reddit-comment__children${atIndentCap ? " reddit-comment__children--cap" : ""}`}
          >
            {node.children.map((child) => (
              <RedditCommentItem
                key={child.id}
                threadId={threadId}
                node={child}
                depth={depth + 1}
                reactionStates={reactionStates}
                isAdmin={isAdmin}
                isLoggedIn={isLoggedIn}
                defaultDisplayName={defaultDisplayName}
                replyToPostId={replyToPostId}
                collapsedIds={collapsedIds}
                onReplyClick={onReplyClick}
                onToggleReplies={onToggleReplies}
                onCancelReply={onCancelReply}
                onPosted={onPosted}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export function ThreadPostList({
  threadId,
  posts,
  reactionStates,
  isAdmin = false,
  isLoggedIn,
  defaultDisplayName,
  replyToPostId,
  collapsedIds,
  onReplyClick,
  onToggleReplies,
  onCancelReply,
  onPosted,
}: ThreadPostListProps) {
  const postTree = useMemo(() => buildDiscussionPostTree(posts), [posts]);

  if (posts.length === 0) {
    return (
      <p className="py-6 text-sm text-zinc-500">
        まだコメントはありません。最初の意見を書いてみてください。
      </p>
    );
  }

  return (
    <div className="reddit-comment-list">
      {postTree.map((node) => (
        <RedditCommentItem
          key={node.id}
          threadId={threadId}
          node={node}
          depth={0}
          reactionStates={reactionStates}
          isAdmin={isAdmin}
          isLoggedIn={isLoggedIn}
          defaultDisplayName={defaultDisplayName}
          replyToPostId={replyToPostId}
          collapsedIds={collapsedIds}
          onReplyClick={onReplyClick}
          onToggleReplies={onToggleReplies}
          onCancelReply={onCancelReply}
          onPosted={onPosted}
        />
      ))}
    </div>
  );
}
