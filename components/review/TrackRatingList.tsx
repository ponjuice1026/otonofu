"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";
import {
  submitTrackRating,
  type RatingActionState,
} from "@/app/albums/[id]/actions";
import { RatingSlider, RATING_UNSET } from "@/components/ui/RatingSlider";
import { StarRating } from "@/components/ui/StarRating";
import { isValidRating } from "@/lib/ratings";

export type TrackWithId = {
  id: string;
  number: number;
  name: string;
  duration: string;
};

type TrackRatingListProps = {
  albumId: string;
  tracks: TrackWithId[];
  spotifyUrl?: string | null;
  isLoggedIn: boolean;
  userRatings: Record<string, number>;
  communityAverages: Record<string, { avg: number; count: number }>;
};

const initialState: RatingActionState = {};

function TrackRatingRow({
  albumId,
  track,
  initialRating,
  communityAvg,
  isLoggedIn,
}: {
  albumId: string;
  track: TrackWithId;
  initialRating: number;
  communityAvg?: { avg: number; count: number };
  isLoggedIn: boolean;
}) {
  const router = useRouter();
  const [rating, setRating] = useState(initialRating);
  const [state, formAction, pending] = useActionState(
    submitTrackRating,
    initialState,
  );

  useEffect(() => {
    if (state.success) {
      router.refresh();
    }
  }, [state.success, router]);

  return (
    <li className="px-4 py-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-4">
          <span className="w-6 shrink-0 text-right font-mono text-zinc-500">
            {track.number}
          </span>
          <div className="min-w-0">
            <p className="truncate text-zinc-100">{track.name}</p>
            <p className="text-xs text-zinc-500">{track.duration}</p>
          </div>
        </div>

        <div className="flex w-full flex-col items-start gap-2 sm:w-auto sm:items-end">
          {communityAvg && communityAvg.count > 0 && (
            <div className="flex items-center gap-2 text-xs text-zinc-500">
              <span>平均</span>
              <StarRating value={communityAvg.avg} size="sm" showBar />
              <span>({communityAvg.count})</span>
            </div>
          )}

          {isLoggedIn ? (
            <form action={formAction} className="flex w-full flex-col items-start gap-1 sm:w-64">
              <input type="hidden" name="albumId" value={albumId} />
              <input type="hidden" name="spotifyTrackId" value={track.id} />
              <input type="hidden" name="trackNumber" value={track.number} />
              <input type="hidden" name="trackName" value={track.name} />
              <input type="hidden" name="rating" value={rating >= 0 ? rating : ""} />

              <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center">
                <RatingSlider
                  value={rating}
                  onChange={setRating}
                  disabled={pending}
                  className="w-full"
                />
                <button
                  type="submit"
                  disabled={pending || !isValidRating(rating)}
                  className="shrink-0 rounded border border-zinc-700 px-2 py-1 text-xs text-zinc-300 hover:border-amber-500/50 hover:text-amber-400 disabled:opacity-50"
                >
                  {pending ? "…" : "保存"}
                </button>
              </div>
              {state.success && (
                <p className="text-xs text-emerald-300">{state.success}</p>
              )}
              {state.error && (
                <p className="text-xs text-red-300">{state.error}</p>
              )}
            </form>
          ) : (
            <p className="text-xs text-zinc-500">ログインで評価できます</p>
          )}
        </div>
      </div>
    </li>
  );
}

export function TrackRatingList({
  albumId,
  tracks,
  spotifyUrl,
  isLoggedIn,
  userRatings,
  communityAverages,
}: TrackRatingListProps) {
  if (tracks.length === 0) return null;

  return (
    <section className="mt-10">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-zinc-100">収録曲</h2>
        {spotifyUrl && (
          <a
            href={spotifyUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-amber-400 hover:underline"
          >
            Spotify で聴く →
          </a>
        )}
      </div>

      {!isLoggedIn && (
        <p className="mb-3 text-sm text-zinc-500">
          曲ごとに評価するには{" "}
          <Link href="/login" className="text-amber-400 hover:underline">
            ログイン
          </Link>
          してください。
        </p>
      )}

      <ol className="divide-y divide-zinc-800 rounded-lg border border-zinc-800">
        {tracks.map((track) => (
          <TrackRatingRow
            key={track.id}
            albumId={albumId}
            track={track}
            initialRating={userRatings[track.id] ?? RATING_UNSET}
            communityAvg={communityAverages[track.id]}
            isLoggedIn={isLoggedIn}
          />
        ))}
      </ol>
    </section>
  );
}
