"use client";

import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import type { SearchAlbumHit, SearchArtistHit } from "@/lib/data/search";

export type PollOptionDraft =
  | { type: "text"; label: string }
  | {
      type: "album";
      label: string;
      albumId: string;
      coverUrl?: string;
      spotifyId?: string;
      artistName?: string;
    }
  | {
      type: "artist";
      label: string;
      artistId: string;
      imageUrl?: string;
      spotifyId?: string;
    };

type PollOptionPickerProps = {
  index: number;
  option: PollOptionDraft;
  onChange: (next: PollOptionDraft) => void;
  onRemove: () => void;
  removable: boolean;
};

type SearchKind = "album" | "artist";

type SearchResponse = {
  artists: SearchArtistHit[];
  albums: SearchAlbumHit[];
};

function coverSrc(hit: { coverUrl?: string; spotifyId?: string }): string | undefined {
  if (hit.coverUrl) return hit.coverUrl;
  if (hit.spotifyId) return `/api/covers/album/${hit.spotifyId}`;
  return undefined;
}

function artistSrc(hit: { imageUrl?: string; spotifyId?: string }): string | undefined {
  if (hit.imageUrl) return hit.imageUrl;
  if (hit.spotifyId) return `/api/covers/artist/${hit.spotifyId}`;
  return undefined;
}

export function PollOptionPicker({
  index,
  option,
  onChange,
  onRemove,
  removable,
}: PollOptionPickerProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResponse | null>(null);
  const [loading, setLoading] = useState(false);

  const isText = option.type === "text";

  function setType(type: "text" | "album" | "artist") {
    if (type === option.type) return;
    if (type === "text") {
      onChange({ type: "text", label: option.label });
    } else {
      onChange({ type, label: "" } as PollOptionDraft);
    }
    setQuery("");
    setResults(null);
  }

  const fetchResults = useCallback(async (value: string) => {
    const trimmed = value.trim();
    if (trimmed.length < 1) {
      setResults(null);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(
        `/api/search?q=${encodeURIComponent(trimmed)}&limit=6`,
      );
      if (!res.ok) throw new Error("search failed");
      const data = (await res.json()) as SearchResponse;
      setResults(data);
    } catch {
      setResults({ artists: [], albums: [] });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isText) return;
    const timer = window.setTimeout(() => void fetchResults(query), 280);
    return () => window.clearTimeout(timer);
  }, [query, isText, fetchResults]);

  const isAlbumSelected = option.type === "album" && Boolean(option.albumId);
  const isArtistSelected = option.type === "artist" && Boolean(option.artistId);
  const hasSelection = isAlbumSelected || isArtistSelected;

  const visibleHits: SearchKind extends "album"
    ? SearchAlbumHit[]
    : SearchArtistHit[] | SearchAlbumHit[] =
    option.type === "album"
      ? results?.albums ?? []
      : option.type === "artist"
        ? results?.artists ?? []
        : [];

  return (
    <div className="rounded-md border border-[var(--border-strong)] bg-[var(--surface-raised)] p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-[var(--muted-foreground)]">選択肢 {index + 1}</p>
        <button
          type="button"
          onClick={onRemove}
          disabled={!removable}
          className="rounded border border-[var(--border-strong)] px-2 py-0.5 text-xs text-[var(--muted-foreground)] transition hover:border-[var(--border-strong)] disabled:opacity-40"
        >
          削除
        </button>
      </div>

      <div className="mb-3 flex gap-1.5">
        {(["text", "album", "artist"] as const).map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setType(value)}
            className={`rounded-md border px-2.5 py-1 text-xs transition ${
              option.type === value
                ? "border-[var(--brand-amber)]/60 bg-[var(--brand-amber-soft)] text-[var(--brand-amber)]"
                : "border-[var(--border-strong)] text-[var(--muted-foreground)] hover:border-[var(--border-strong)]"
            }`}
          >
            {value === "text" && "テキスト"}
            {value === "album" && "アルバム"}
            {value === "artist" && "アーティスト"}
          </button>
        ))}
      </div>

      {isText && (
        <input
          type="text"
          value={option.label}
          onChange={(e) => onChange({ type: "text", label: e.target.value })}
          maxLength={80}
          placeholder="例: 1st アルバム"
          className="input-field text-sm"
        />
      )}

      {!isText && hasSelection && (
        <SelectedItem
          option={option}
          onClear={() =>
            onChange(
              option.type === "album"
                ? { type: "album", label: "", albumId: "" }
                : { type: "artist", label: "", artistId: "" },
            )
          }
        />
      )}

      {!isText && !hasSelection && (
        <div className="flex flex-col gap-2">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={
              option.type === "album"
                ? "アルバム名で検索"
                : "アーティスト名で検索"
            }
            className="input-field text-sm"
          />

          {loading && (
            <p className="px-1 text-xs text-[var(--muted)]">検索中…</p>
          )}

          {!loading && query.trim().length > 0 && visibleHits.length === 0 && (
            <p className="px-1 text-xs text-[var(--muted)]">
              候補が見つかりませんでした
            </p>
          )}

          {visibleHits.length > 0 && (
            <ul className="max-h-56 overflow-y-auto rounded-md border border-[var(--border)] bg-[var(--surface)]">
              {option.type === "album" &&
                (visibleHits as SearchAlbumHit[]).map((hit) => (
                  <li key={hit.id}>
                    <button
                      type="button"
                      onClick={() =>
                        onChange({
                          type: "album",
                          label: `${hit.title} / ${hit.artistName}`,
                          albumId: hit.id,
                          coverUrl: hit.coverUrl,
                          spotifyId: hit.spotifyId,
                          artistName: hit.artistName,
                        })
                      }
                      className="flex w-full items-center gap-3 px-3 py-2 text-left transition hover:bg-[var(--surface-hover)]"
                    >
                      <CoverBox src={coverSrc(hit)} rounded="rounded" />
                      <div className="min-w-0">
                        <p className="truncate text-sm text-[var(--foreground)]">
                          {hit.title}
                        </p>
                        <p className="truncate text-xs text-[var(--muted)]">
                          {hit.artistName} · {hit.year}
                        </p>
                      </div>
                    </button>
                  </li>
                ))}
              {option.type === "artist" &&
                (visibleHits as SearchArtistHit[]).map((hit) => (
                  <li key={hit.id}>
                    <button
                      type="button"
                      onClick={() =>
                        onChange({
                          type: "artist",
                          label: hit.name,
                          artistId: hit.id,
                          imageUrl: hit.imageUrl,
                          spotifyId: hit.spotifyId,
                        })
                      }
                      className="flex w-full items-center gap-3 px-3 py-2 text-left transition hover:bg-[var(--surface-hover)]"
                    >
                      <CoverBox src={artistSrc(hit)} rounded="rounded-full" />
                      <div className="min-w-0">
                        <p className="truncate text-sm text-[var(--foreground)]">
                          {hit.name}
                        </p>
                        {hit.nameEn && (
                          <p className="truncate text-xs text-[var(--muted)]">
                            {hit.nameEn}
                          </p>
                        )}
                      </div>
                    </button>
                  </li>
                ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function SelectedItem({
  option,
  onClear,
}: {
  option: PollOptionDraft;
  onClear: () => void;
}) {
  if (option.type === "album") {
    return (
      <div className="flex items-center gap-3 rounded-md border border-[var(--brand-amber)]/30 bg-[var(--brand-amber-soft)] px-3 py-2">
        <CoverBox src={coverSrc(option)} rounded="rounded" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm text-[var(--foreground)]">{option.label}</p>
          <p className="text-xs text-[var(--brand-amber)]">アルバム</p>
        </div>
        <button
          type="button"
          onClick={onClear}
          className="shrink-0 rounded border border-[var(--border-strong)] px-2 py-1 text-xs text-[var(--muted-foreground)] hover:border-[var(--border-strong)]"
        >
          変更
        </button>
      </div>
    );
  }
  if (option.type === "artist") {
    return (
      <div className="flex items-center gap-3 rounded-md border border-[var(--brand-amber)]/30 bg-[var(--brand-amber-soft)] px-3 py-2">
        <CoverBox src={artistSrc(option)} rounded="rounded-full" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm text-[var(--foreground)]">{option.label}</p>
          <p className="text-xs text-[var(--brand-amber)]">アーティスト</p>
        </div>
        <button
          type="button"
          onClick={onClear}
          className="shrink-0 rounded border border-[var(--border-strong)] px-2 py-1 text-xs text-[var(--muted-foreground)] hover:border-[var(--border-strong)]"
        >
          変更
        </button>
      </div>
    );
  }
  return null;
}

function CoverBox({
  src,
  rounded,
}: {
  src: string | undefined;
  rounded: "rounded" | "rounded-full";
}) {
  return (
    <div
      className={`relative h-10 w-10 shrink-0 overflow-hidden bg-[var(--surface-hover)] ${rounded}`}
    >
      {src ? (
        <Image src={src} alt="" fill className="object-cover" sizes="40px" />
      ) : null}
    </div>
  );
}
