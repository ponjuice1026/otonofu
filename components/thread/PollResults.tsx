import Image from "next/image";
import Link from "next/link";
import type {
  DiscussionPoll,
  DiscussionPollOption,
  PollOptionAlbumRef,
  PollOptionArtistRef,
} from "@/lib/types";

type PollResultsProps = {
  poll: DiscussionPoll;
  preview?: boolean;
};

export function PollResults({ poll, preview = false }: PollResultsProps) {
  const tallyOptions = poll.options.filter((option) => !option.excludeFromTally);
  const viewOnlyOptions = poll.options.filter((option) => option.excludeFromTally);
  const total = Math.max(poll.totalVotes, 1);
  const selectedOption = poll.options.find(
    (option) => option.id === poll.userVotedOptionId,
  );
  const viewedOnly = selectedOption?.excludeFromTally === true;

  return (
    <div>
      {!preview && (
        <p className="mb-3 text-sm text-zinc-400">
          {viewedOnly
            ? "結果を閲覧しました。得票率は集計対象の選択肢のみ表示しています。"
            : "投票ありがとうございます。各選択肢の得票率は以下の通りです。"}
        </p>
      )}
      {preview && (
        <p className="mb-3 text-xs text-zinc-500">
          投票後はこのようにパーセンテージと棒グラフで結果が表示されます（サンプル）。
          結果閲覧用の選択肢は集計に含まれません。
        </p>
      )}

      <ul className="flex flex-col gap-3">
        {tallyOptions.map((option) => {
          const percent = Math.round((option.voteCount / total) * 100);
          const isSelected =
            !preview && !viewedOnly && option.id === poll.userVotedOptionId;

          return (
            <li
              key={option.id}
              className="rounded-md border border-zinc-800 bg-zinc-900/40 p-3"
            >
              <div className="mb-2 flex items-start gap-3">
                <OptionMedia option={option} />
                <div className="min-w-0 flex-1">
                  <OptionLabel option={option} highlight={isSelected} />
                  {isSelected && (
                    <p className="mt-0.5 text-xs text-amber-400/90">
                      あなたの投票
                    </p>
                  )}
                </div>
                <div className="shrink-0 text-right">
                  <p
                    className={`text-lg font-bold tabular-nums ${
                      isSelected ? "text-amber-300" : "text-zinc-100"
                    }`}
                  >
                    {percent}%
                  </p>
                  <p className="text-xs text-zinc-500">
                    {option.voteCount} 票
                  </p>
                </div>
              </div>
              <div className="h-2.5 overflow-hidden rounded-full bg-zinc-800">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    isSelected ? "bg-amber-500" : "bg-zinc-600"
                  }`}
                  style={{ width: `${percent}%` }}
                  role="progressbar"
                  aria-valuenow={percent}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={`${optionLabelText(option)} ${percent}%`}
                />
              </div>
            </li>
          );
        })}
      </ul>

      {viewOnlyOptions.length > 0 && (
        <div className="mt-4 rounded-md border border-dashed border-sky-500/20 bg-sky-500/5 p-3">
          <p className="mb-2 text-xs font-medium text-sky-300/90">
            結果閲覧用（得票集計外）
          </p>
          <ul className="flex flex-col gap-2">
            {viewOnlyOptions.map((option) => {
              const isSelected =
                !preview && option.id === poll.userVotedOptionId;

              return (
                <li
                  key={option.id}
                  className="flex items-center gap-3 rounded-md border border-sky-500/20 bg-zinc-900/40 px-3 py-2"
                >
                  <div className="min-w-0 flex-1">
                    <OptionLabel option={option} highlight={isSelected} />
                    {isSelected && (
                      <p className="mt-0.5 text-xs text-sky-300/90">
                        あなたが選んだ閲覧用の選択肢
                      </p>
                    )}
                  </div>
                  <p className="shrink-0 text-xs text-zinc-500">集計外</p>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

type PollResultPreviewProps = {
  rows: Array<{ id: string; label: string; voteCount: number; percent: number }>;
};

export function PollResultPreview({ rows }: PollResultPreviewProps) {
  if (rows.length < 2) return null;

  const poll: DiscussionPoll = {
    threadId: "preview",
    totalVotes: rows.reduce((sum, row) => sum + row.voteCount, 0),
    userVotedOptionId: null,
    options: rows.map((row, index) => ({
      id: row.id,
      label: row.label,
      position: index,
      voteCount: row.voteCount,
      type: "text" as const,
      excludeFromTally: false,
    })),
  };

  return (
    <div className="mt-4 rounded-md border border-dashed border-zinc-700 bg-zinc-950/40 p-4">
      <p className="mb-3 text-xs font-medium uppercase tracking-wide text-zinc-500">
        結果表示のプレビュー
      </p>
      <PollResults poll={poll} preview />
    </div>
  );
}

function optionLabelText(option: DiscussionPollOption): string {
  if (option.type === "album" && option.album) return option.album.title;
  if (option.type === "artist" && option.artist) return option.artist.name;
  return option.label;
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
  highlight = false,
}: {
  option: DiscussionPollOption;
  highlight?: boolean;
}) {
  const titleClass = highlight
    ? "font-medium text-amber-300"
    : "text-zinc-200";

  if (option.type === "album" && option.album) {
    return (
      <div className="min-w-0">
        <p className={`truncate text-sm ${titleClass}`}>{option.album.title}</p>
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
        <p className={`truncate text-sm ${titleClass}`}>{option.artist.name}</p>
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
    <p className={`min-w-0 text-sm ${titleClass}`}>{option.label}</p>
  );
}
