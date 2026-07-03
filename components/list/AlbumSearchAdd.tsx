"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { addAlbumToList } from "@/app/lists/actions";
import type { SearchAlbumHit } from "@/lib/data/search";

type AlbumSearchAddProps = {
  listId: string;
};

function coverSrc(hit: {
  coverUrl?: string;
  spotifyId?: string;
}): string | undefined {
  if (hit.coverUrl) return hit.coverUrl;
  if (hit.spotifyId) return `/api/covers/album/${hit.spotifyId}`;
  return undefined;
}

/**
 * アルバムを検索して選択 → 一言メモ入力 → リストに追加。
 * 既存の検索API (/api/search) を再利用する。
 */
export function AlbumSearchAdd({ listId }: AlbumSearchAddProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchAlbumHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<SearchAlbumHit | null>(null);
  const [note, setNote] = useState("");
  const [message, setMessage] = useState<{
    type: "error" | "success";
    text: string;
  } | null>(null);
  const [pending, setPending] = useState(false);
  const noteRef = useRef<HTMLInputElement>(null);

  const fetchResults = useCallback(async (value: string) => {
    const trimmed = value.trim();
    if (trimmed.length < 1) {
      setResults([]);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(
        `/api/search?q=${encodeURIComponent(trimmed)}&limit=8`,
      );
      if (!res.ok) throw new Error("search failed");
      const data = (await res.json()) as { albums: SearchAlbumHit[] };
      setResults(data.albums ?? []);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selected) return;
    const timer = window.setTimeout(() => void fetchResults(query), 280);
    return () => window.clearTimeout(timer);
  }, [query, selected, fetchResults]);

  async function handleAdd() {
    if (!selected) return;
    setPending(true);
    setMessage(null);
    try {
      const formData = new FormData();
      formData.set("listId", listId);
      formData.set("albumId", selected.id);
      formData.set("note", note);
      const result = await addAlbumToList({}, formData);
      if (result.error) {
        setMessage({ type: "error", text: result.error });
      } else {
        setMessage({
          type: "success",
          text: result.success ?? "追加しました。",
        });
        setSelected(null);
        setQuery("");
        setNote("");
        setResults([]);
        router.refresh();
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="rounded-md border border-zinc-700 bg-zinc-900/60 p-4">
      <h3 className="mb-3 text-sm font-semibold text-neutral-200">
        アルバムを追加
      </h3>

      {selected ? (
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3 rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2">
            <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded bg-zinc-800">
              {coverSrc(selected) ? (
                <Image
                  src={coverSrc(selected)!}
                  alt=""
                  fill
                  className="object-cover"
                  sizes="48px"
                  unoptimized
                />
              ) : null}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm text-neutral-100">
                {selected.title}
              </p>
              <p className="truncate text-xs text-neutral-500">
                {selected.artistName} · {selected.year}
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setSelected(null);
                setNote("");
              }}
              className="shrink-0 rounded border border-zinc-700 px-2 py-1 text-xs text-neutral-400 hover:border-zinc-500"
            >
              変更
            </button>
          </div>

          <input
            ref={noteRef}
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={500}
            placeholder="一言メモ（任意）"
            className="input-field w-full text-sm"
          />

          <div>
            <button
              type="button"
              onClick={handleAdd}
              disabled={pending}
              className="btn-primary"
            >
              {pending ? "追加中…" : "リストに追加"}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="アルバム名で検索"
            className="input-field w-full text-sm"
          />
          {loading && <p className="px-1 text-xs text-neutral-500">検索中…</p>}
          {!loading && query.trim().length > 0 && results.length === 0 && (
            <p className="px-1 text-xs text-neutral-500">
              候補が見つかりませんでした
            </p>
          )}
          {results.length > 0 && (
            <ul className="max-h-64 overflow-y-auto rounded-md border border-zinc-800 bg-zinc-950">
              {results.map((hit) => (
                <li key={hit.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setSelected(hit);
                      setMessage(null);
                    }}
                    className="flex w-full items-center gap-3 px-3 py-2 text-left transition hover:bg-zinc-900"
                  >
                    <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded bg-zinc-800">
                      {coverSrc(hit) ? (
                        <Image
                          src={coverSrc(hit)!}
                          alt=""
                          fill
                          className="object-cover"
                          sizes="40px"
                          unoptimized
                        />
                      ) : null}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm text-neutral-100">
                        {hit.title}
                      </p>
                      <p className="truncate text-xs text-neutral-500">
                        {hit.artistName} · {hit.year}
                      </p>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {message && (
        <p
          className={`mt-3 text-sm ${
            message.type === "error" ? "text-red-400" : "text-emerald-400"
          }`}
        >
          {message.text}
        </p>
      )}
    </div>
  );
}
