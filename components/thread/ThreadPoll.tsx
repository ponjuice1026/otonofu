"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useMemo, useState } from "react";
import {
  voteDiscussionPoll,
  type ThreadActionState,
} from "@/app/threads/actions";
import { PollResults } from "@/components/thread/PollResults";
import { ThreadPollAddOption } from "@/components/thread/ThreadPollAddOption";
import { POLL_OPTION_MAX_COUNT } from "@/lib/threads/validate";
import type {
  DiscussionPoll,
  DiscussionPollOption,
  PollOptionAlbumRef,
  PollOptionArtistRef,
} from "@/lib/types";

type ThreadPollProps = {
  poll: DiscussionPoll;
  canAddOption?: boolean;
};

const initialState: ThreadActionState = {};

export function ThreadPoll({ poll, canAddOption = false }: ThreadPollProps) {
  const router = useRouter();
  const [displayPoll, setDisplayPoll] = useState(poll);
  const [state, formAction, pending] = useActionState(
    voteDiscussionPoll,
    initialState,
  );

  useEffect(() => {
    setDisplayPoll(poll);
  }, [poll]);

  useEffect(() => {
    if (!state.success || !state.votedOptionId) return;

    setDisplayPoll((current) => {
      if (current.userVotedOptionId) return current;

      const votedOption = current.options.find(
        (option) => option.id === state.votedOptionId,
      );
      const isViewOnly = votedOption?.excludeFromTally === true;

      return {
        ...current,
        userVotedOptionId: state.votedOptionId ?? null,
        totalVotes: isViewOnly ? current.totalVotes : current.totalVotes + 1,
        options: current.options.map((option) =>
          option.id === state.votedOptionId
            ? {
                ...option,
                voteCount: isViewOnly
                  ? option.voteCount
                  : option.voteCount + 1,
              }
            : option,
        ),
      };
    });

    router.refresh();
  }, [state.success, state.votedOptionId, router]);

  const tallyOptions = useMemo(
    () => displayPoll.options.filter((option) => !option.excludeFromTally),
    [displayPoll.options],
  );
  const viewOnlyOptions = useMemo(
    () => displayPoll.options.filter((option) => option.excludeFromTally),
    [displayPoll.options],
  );

  const hasVoted = displayPoll.userVotedOptionId !== null;
  const total = displayPoll.totalVotes;
  const selectedOption = displayPoll.options.find(
    (option) => option.id === displayPoll.userVotedOptionId,
  );
  const viewedOnly = selectedOption?.excludeFromTally === true;

  return (
    <section className="mb-8 rounded-lg border border-zinc-800 bg-zinc-900/50 px-5 py-5">
      <h2 className="mb-1 text-lg font-semibold text-zinc-100">投票</h2>
      <p className="mb-4 text-xs text-zinc-500">
        ログイン不要 · 1人1票
        {hasVoted
          ? viewedOnly
            ? " · 結果閲覧済み"
            : total > 0
              ? ` · 集計対象 ${total} 票`
              : ""
          : ""}
      </p>

      {hasVoted ? (
        <PollResults poll={displayPoll} />
      ) : (
        <form action={formAction} className="flex flex-col gap-4">
          <input type="hidden" name="threadId" value={poll.threadId} />

          {tallyOptions.length > 0 && (
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-1 text-xs font-medium text-zinc-400">
                投票する
              </legend>
              {tallyOptions.map((option) => (
                <PollOptionChoice key={option.id} option={option} />
              ))}
            </fieldset>
          )}

          {viewOnlyOptions.length > 0 && (
            <fieldset className="flex flex-col gap-2 rounded-md border border-dashed border-sky-500/20 bg-sky-500/5 p-3">
              <legend className="px-1 text-xs font-medium text-sky-300/90">
                結果だけ見る（得票集計外）
              </legend>
              {viewOnlyOptions.map((option) => (
                <PollOptionChoice key={option.id} option={option} viewOnly />
              ))}
            </fieldset>
          )}

          {state.error && (
            <p className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
              {state.error}
            </p>
          )}

          <button
            type="submit"
            disabled={pending}
            className="self-start rounded-md bg-amber-500 px-4 py-2 text-sm font-semibold text-zinc-950 transition hover:bg-amber-400 disabled:opacity-60"
          >
            {pending ? "送信中…" : "投票する / 結果を見る"}
          </button>
        </form>
      )}

      {hasVoted && state.error && (
        <p className="mt-3 rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {state.error}
        </p>
      )}

      {canAddOption && (
        <ThreadPollAddOption
          threadId={poll.threadId}
          optionCount={poll.options.length}
          maxOptions={POLL_OPTION_MAX_COUNT}
        />
      )}
    </section>
  );
}

function PollOptionChoice({
  option,
  viewOnly = false,
}: {
  option: DiscussionPollOption;
  viewOnly?: boolean;
}) {
  return (
    <label
      className={`flex cursor-pointer items-center gap-3 rounded-md border px-3 py-2.5 transition ${
        viewOnly
          ? "border-sky-500/20 bg-zinc-900/80 hover:border-sky-500/40 has-[:checked]:border-sky-400/60 has-[:checked]:bg-sky-500/10"
          : "border-zinc-700 bg-zinc-900 hover:border-amber-500/40 has-[:checked]:border-amber-500/60 has-[:checked]:bg-amber-500/5"
      }`}
    >
      <input
        type="radio"
        name="optionId"
        value={option.id}
        required
        className={
          viewOnly
            ? "text-sky-400 focus:ring-sky-400/40"
            : "text-amber-500 focus:ring-amber-500/50"
        }
      />
      <OptionMedia option={option} />
      <OptionLabel option={option} viewOnly={viewOnly} />
    </label>
  );
}

function albumCover(album: PollOptionAlbumRef): string | undefined {
  if (album.coverUrl) return album.coverUrl;
  if (album.spotifyId) return `/api/covers/album/${album.spotifyId}`;
  return undefined;
}

function artistImage(artist: PollOptionArtistRef): string | undefined {
  if (artist.imageUrl) return artist.imageUrl;
  if (artist.spotifyId) return `/api/covers/artist/${artist.spotifyId}`;
  return undefined;
}

function OptionMedia({ option }: { option: DiscussionPollOption }) {
  if (option.type === "album" && option.album) {
    const src = albumCover(option.album);
    return (
      <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded bg-zinc-800">
        {src ? (
          <Image src={src} alt="" fill className="object-cover" sizes="40px" />
        ) : null}
      </div>
    );
  }
  if (option.type === "artist" && option.artist) {
    const src = artistImage(option.artist);
    return (
      <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full bg-zinc-800">
        {src ? (
          <Image src={src} alt="" fill className="object-cover" sizes="40px" />
        ) : null}
      </div>
    );
  }
  return null;
}

function OptionLabel({
  option,
  viewOnly = false,
}: {
  option: DiscussionPollOption;
  viewOnly?: boolean;
}) {
  if (option.type === "album" && option.album) {
    return (
      <div className="min-w-0">
        <p className="truncate text-sm text-zinc-200">{option.album.title}</p>
        <p className="truncate text-xs text-zinc-500">
          <Link
            href={`/albums/${option.album.id}`}
            className="hover:text-amber-400"
            onClick={(e) => e.stopPropagation()}
          >
            {option.album.artistName}
            {option.album.year ? ` · ${option.album.year}` : ""}
          </Link>
        </p>
      </div>
    );
  }
  if (option.type === "artist" && option.artist) {
    return (
      <div className="min-w-0">
        <p className="truncate text-sm text-zinc-200">{option.artist.name}</p>
        <Link
          href={`/artists/${option.artist.id}`}
          className="text-xs text-zinc-500 hover:text-amber-400"
          onClick={(e) => e.stopPropagation()}
        >
          アーティストページへ →
        </Link>
      </div>
    );
  }
  return (
    <div className="min-w-0">
      <p className="text-sm text-zinc-200">{option.label}</p>
      {viewOnly && (
        <p className="text-xs text-sky-300/80">得票率の集計には含まれません</p>
      )}
    </div>
  );
}
