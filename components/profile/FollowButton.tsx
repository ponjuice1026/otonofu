"use client";

import { useState, useTransition } from "react";
import { followUser, unfollowUser } from "@/app/users/actions";

type Props = {
  targetId: string;
  initialFollowing: boolean;
};

export function FollowButton({ targetId, initialFollowing }: Props) {
  const [following, setFollowing] = useState(initialFollowing);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    setError(null);
    // 楽観的更新。失敗時は元に戻す。
    const next = !following;
    setFollowing(next);

    startTransition(async () => {
      const result = next
        ? await followUser(targetId)
        : await unfollowUser(targetId);

      if (result.error) {
        setFollowing(!next);
        setError(result.error);
      }
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={isPending}
        aria-pressed={following}
        className={
          following
            ? "btn-secondary text-sm disabled:opacity-50"
            : "btn-primary text-sm disabled:opacity-50"
        }
      >
        {following ? "フォロー中" : "フォローする"}
      </button>
      {error && <span className="text-xs text-red-400">{error}</span>}
    </div>
  );
}
