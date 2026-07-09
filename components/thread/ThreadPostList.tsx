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
  /** 閲覧者のユーザーID。自分のレスの削除ボタン表示判定に使う。 */
  currentUserId: string | null;
  defaultDisplayName: string | null;
  replyToPostId: string | null;
  collapsedIds: Set<string>;
  onReplyClick: (post: DiscussionPost) => void;
  onToggleReplies: (node: DiscussionPostNode) => void;
  onCancelReply: () => void;
  onPosted: () => void;
  /** スレが凍結中か（監査 D-3）。凍結中は返信フォーム・返信ボタンを隠す。 */
  isLocked?: boolean;
};

const EMPTY_REACTION: ReactionState = { good: 0, bad: 0, userReaction: null };

type RedditCommentItemProps = {
  threadId: string;
  node: DiscussionPostNode;
  depth: number;
  reactionStates: Record<string, ReactionState>;
  isAdmin: boolean;
  isLoggedIn: boolean;
  currentUserId: string | null;
  defaultDisplayName: string | null;
  replyToPostId: string | null;
  collapsedIds: Set<string>;
  onReplyClick: (post: DiscussionPost) => void;
  onToggleReplies: (node: DiscussionPostNode) => void;
  onCancelReply: () => void;
  onPosted: () => void;
  isLocked: boolean;
};

function RedditCommentItem({
  threadId,
  node,
  depth,
  reactionStates,
  isAdmin,
  isLoggedIn,
  currentUserId,
  defaultDisplayName,
  replyToPostId,
  collapsedIds,
  onReplyClick,
  onToggleReplies,
  onCancelReply,
  onPosted,
  isLocked,
}: RedditCommentItemProps) {
  const isReplyTarget = replyToPostId === node.id;
  const repliesHidden = collapsedIds.has(node.id);
  const descendantCount = countDiscussionPostDescendants(node);
  const hasChildren = node.children.length > 0;
  const atIndentCap = depth >= REDDIT_MAX_INDENT_DEPTH;
  // 自分のレスか（匿名表示レスでも本人には削除ボタンを出す）。
  // author_id は他者へ露見しない: 削除ボタンは currentUserId===authorId の
  // 本人にのみ描画されるため、匿名投稿者の同一性は第三者に漏れない。
  const isOwnPost =
    currentUserId !== null && node.authorId === currentUserId;
  const canDelete = isAdmin || isOwnPost;

  return (
    <div
      id={`post-${node.id}`}
      className={`reddit-comment scroll-mt-4${isReplyTarget ? " reddit-comment--reply-target" : ""}`}
    >
      <div className="reddit-comment__header">
        <span className="reddit-comment__author">{node.anonymousName}</span>
        {node.threadLocalId && (
          <span className="reddit-comment__local-id text-zinc-600">
            ID:{node.threadLocalId}
          </span>
        )}
        <time dateTime={node.createdAt} className="reddit-comment__time">
          {formatThreadDate(node.createdAt)}
        </time>
        {canDelete && (
          <DeletePostButton postId={node.id} isOwner={isOwnPost} />
        )}
      </div>

      <ExpandableText
        text={node.body}
        className="reddit-comment__body text-sm leading-relaxed text-zinc-100"
      />

      <div className="reddit-comment__toolbar">
        {!isLocked && (
          <button
            type="button"
            onClick={() => onReplyClick(node)}
            className="reddit-comment__toolbar-action"
          >
            {isReplyTarget ? "キャンセル" : "返信"}
          </button>
        )}
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

      {isReplyTarget && !isLocked && (
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
                currentUserId={currentUserId}
                defaultDisplayName={defaultDisplayName}
                replyToPostId={replyToPostId}
                collapsedIds={collapsedIds}
                onReplyClick={onReplyClick}
                onToggleReplies={onToggleReplies}
                onCancelReply={onCancelReply}
                onPosted={onPosted}
                isLocked={isLocked}
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
  currentUserId,
  defaultDisplayName,
  replyToPostId,
  collapsedIds,
  onReplyClick,
  onToggleReplies,
  onCancelReply,
  onPosted,
  isLocked = false,
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
          currentUserId={currentUserId}
          defaultDisplayName={defaultDisplayName}
          replyToPostId={replyToPostId}
          collapsedIds={collapsedIds}
          onReplyClick={onReplyClick}
          onToggleReplies={onToggleReplies}
          onCancelReply={onCancelReply}
          onPosted={onPosted}
          isLocked={isLocked}
        />
      ))}
    </div>
  );
}
