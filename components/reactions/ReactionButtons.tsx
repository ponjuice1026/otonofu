"use client";

import { useOptimistic, useTransition } from "react";
import {
  togglePostReaction,
  toggleReviewReaction,
} from "@/app/reactions/actions";
import type { ReactionKind, ReactionState } from "@/lib/types";

type ReactionButtonsProps = {
  target:
    | { type: "review"; reviewId: string; albumId?: string }
    | { type: "post"; postId: string; threadId?: string };
  state: ReactionState;
};

type OptimisticAction = ReactionKind;

function applyReaction(
  state: ReactionState,
  next: OptimisticAction,
): ReactionState {
  const current = state.userReaction;
  let { good, bad } = state;

  if (current === "good") good = Math.max(0, good - 1);
  if (current === "bad") bad = Math.max(0, bad - 1);

  let userReaction: ReactionKind | null = next;
  if (current === next) {
    userReaction = null;
  } else {
    if (next === "good") good += 1;
    if (next === "bad") bad += 1;
  }

  return { good, bad, userReaction };
}

export function ReactionButtons({ target, state }: ReactionButtonsProps) {
  const [optimistic, setOptimistic] = useOptimistic(state, applyReaction);
  const [isPending, startTransition] = useTransition();

  const dispatch = (reaction: ReactionKind) => {
    startTransition(async () => {
      setOptimistic(reaction);
      if (target.type === "review") {
        await toggleReviewReaction(target.reviewId, reaction, target.albumId);
      } else {
        await togglePostReaction(target.postId, reaction, target.threadId);
      }
    });
  };

  const isGood = optimistic.userReaction === "good";
  const isBad = optimistic.userReaction === "bad";

  return (
    <div className="flex items-center gap-1.5 text-sm">
      <button
        type="button"
        disabled={isPending}
        onClick={() => dispatch("good")}
        className={`flex items-center gap-1 rounded-md px-1.5 py-1 transition ${
          isGood
            ? "text-emerald-300"
            : "text-neutral-400 hover:text-emerald-300"
        } ${isPending ? "opacity-60" : ""}`}
        aria-pressed={isGood}
        aria-label="good"
      >
        <span aria-hidden="true">👍</span>
        <span className="num-stat text-base">{optimistic.good}</span>
      </button>
      <button
        type="button"
        disabled={isPending}
        onClick={() => dispatch("bad")}
        className={`flex items-center gap-1 rounded-md px-1.5 py-1 transition ${
          isBad
            ? "text-rose-300"
            : "text-neutral-400 hover:text-rose-300"
        } ${isPending ? "opacity-60" : ""}`}
        aria-pressed={isBad}
        aria-label="bad"
      >
        <span aria-hidden="true">👎</span>
        <span className="num-stat text-base">{optimistic.bad}</span>
      </button>
    </div>
  );
}
