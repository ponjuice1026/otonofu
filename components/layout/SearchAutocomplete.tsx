"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import type {
  SearchAlbumHit,
  SearchArtistHit,
  SearchPostHit,
  SearchReviewHit,
  SearchThreadHit,
  SiteSearchResult,
} from "@/lib/data/search";

function coverSrc(hit: SearchAlbumHit): string | undefined {
  if (hit.coverUrl) return hit.coverUrl;
  if (hit.spotifyId) return `/api/covers/album/${hit.spotifyId}`;
  return undefined;
}

function artistImageSrc(hit: SearchArtistHit): string | undefined {
  if (hit.imageUrl) return hit.imageUrl;
  if (hit.spotifyId) return `/api/covers/artist/${hit.spotifyId}`;
  return undefined;
}

function SearchIcon() {
  return (
    <svg
      aria-hidden
      className="search-field__icon h-4 w-4"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.75}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M10.5 18a7.5 7.5 0 1 0 0-15 7.5 7.5 0 0 0 0 15Z"
      />
      <path strokeLinecap="round" strokeLinejoin="round" d="M16 16l4 4" />
    </svg>
  );
}

type FlatItem =
  | { kind: "thread"; href: string; item: SearchThreadHit }
  | { kind: "post"; href: string; item: SearchPostHit }
  | { kind: "review"; href: string; item: SearchReviewHit }
  | { kind: "artist"; href: string; item: SearchArtistHit }
  | { kind: "album"; href: string; item: SearchAlbumHit };

function buildFlatItems(results: SiteSearchResult | null): FlatItem[] {
  if (!results) return [];

  return [
    ...results.threads.map((item) => ({
      kind: "thread" as const,
      href: `/threads/${item.id}`,
      item,
    })),
    ...results.posts.map((item) => ({
      kind: "post" as const,
      href: `/threads/${item.threadId}#post-${item.id}`,
      item,
    })),
    ...results.reviews.map((item) => ({
      kind: "review" as const,
      href: `/albums/${item.albumId}#review-${item.id}`,
      item,
    })),
    ...results.artists.map((item) => ({
      kind: "artist" as const,
      href: `/artists/${item.id}`,
      item,
    })),
    ...results.albums.map((item) => ({
      kind: "album" as const,
      href: `/albums/${item.id}`,
      item,
    })),
  ];
}

function resultCount(results: SiteSearchResult | null): number {
  if (!results) return 0;
  return (
    results.threads.length +
    results.posts.length +
    results.reviews.length +
    results.artists.length +
    results.albums.length
  );
}

export function SearchAutocomplete() {
  const router = useRouter();
  const listboxId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SiteSearchResult | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [composing, setComposing] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  const flatItems = buildFlatItems(results);
  const abortRef = useRef<AbortController | null>(null);

  const fetchResults = useCallback(async (value: string) => {
    abortRef.current?.abort();

    const trimmed = value.trim();
    if (trimmed.length < 1) {
      abortRef.current = null;
      setResults(null);
      setOpen(false);
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    try {
      const response = await fetch(
        `/api/search?q=${encodeURIComponent(trimmed)}&limit=6`,
        { signal: controller.signal },
      );
      if (!response.ok) throw new Error("search failed");
      const data = (await response.json()) as SiteSearchResult;
      setResults(data);
      setOpen(true);
      setActiveIndex(-1);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }
      setResults({
        artists: [],
        albums: [],
        threads: [],
        reviews: [],
        posts: [],
      });
      setOpen(true);
    } finally {
      if (abortRef.current === controller) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    if (composing) return;

    const timer = window.setTimeout(() => {
      void fetchResults(query);
    }, 280);

    return () => window.clearTimeout(timer);
  }, [query, composing, fetchResults]);

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, []);

  function goToSearchPage(value: string) {
    const trimmed = value.trim();
    if (!trimmed) return;
    setOpen(false);
    router.push(`/search?q=${encodeURIComponent(trimmed)}`);
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      if (open && activeIndex >= 0 && flatItems[activeIndex]) {
        event.preventDefault();
        setOpen(false);
        router.push(flatItems[activeIndex].href);
        return;
      }
      if (query.trim()) {
        event.preventDefault();
        goToSearchPage(query);
      }
      return;
    }

    if (!open || flatItems.length === 0) {
      if (event.key === "Escape") setOpen(false);
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((index) => (index + 1) % flatItems.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) =>
        index <= 0 ? flatItems.length - 1 : index - 1,
      );
    } else if (event.key === "Escape") {
      setOpen(false);
      setActiveIndex(-1);
    }
  }

  const trimmedQuery = query.trim();
  const showEmpty =
    open &&
    !loading &&
    trimmedQuery.length > 0 &&
    resultCount(results) === 0;

  let itemIndex = -1;

  function rowClass(currentIndex: number): string {
    return activeIndex === currentIndex
      ? "bg-[var(--surface-hover)]"
      : "hover:bg-[var(--surface-hover)]/70";
  }

  return (
    <div ref={rootRef} className="relative w-full lg:max-w-md">
      <label htmlFor="site-search" className="sr-only">
        キーワードで検索
      </label>
      <div className="search-field">
        <SearchIcon />
        <input
          ref={inputRef}
          id="site-search"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onFocus={() => {
            if (query.trim() && results) setOpen(true);
          }}
          onCompositionStart={() => setComposing(true)}
          onCompositionEnd={(event) => {
            setComposing(false);
            setQuery(event.currentTarget.value);
          }}
          onKeyDown={handleKeyDown}
          placeholder="キーワードで検索"
          role="combobox"
          aria-expanded={open}
          aria-controls={listboxId}
          aria-autocomplete="list"
          aria-activedescendant={
            activeIndex >= 0 ? `${listboxId}-option-${activeIndex}` : undefined
          }
          className="search-field__input"
        />
      </div>

      {open && (loading || results) && (
        <div
          id={listboxId}
          role="listbox"
          className="surface-panel absolute top-full z-50 mt-2 max-h-[min(28rem,70vh)] w-full overflow-y-auto shadow-[var(--shadow-soft)]"
        >
          {loading && (
            <p className="px-4 py-3 text-sm text-neutral-500">検索中…</p>
          )}

          {showEmpty && (
            <p className="px-4 py-4 text-sm text-neutral-500">
              候補が見つかりませんでした
            </p>
          )}

          {!loading && (results?.threads.length ?? 0) > 0 && (
            <section>
              <p className="sticky top-0 border-b border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
                セッション
              </p>
              <ul>
                {results?.threads.map((thread) => {
                  itemIndex += 1;
                  const currentIndex = itemIndex;
                  return (
                    <li key={thread.id}>
                      <Link
                        id={`${listboxId}-option-${currentIndex}`}
                        href={`/threads/${thread.id}`}
                        role="option"
                        aria-selected={activeIndex === currentIndex}
                        onMouseEnter={() => setActiveIndex(currentIndex)}
                        onClick={() => setOpen(false)}
                        className={`block px-4 py-2.5 transition ${rowClass(currentIndex)}`}
                      >
                        <p className="truncate text-sm font-medium text-neutral-100">
                          {thread.title}
                        </p>
                        <p className="truncate text-xs text-neutral-500">
                          {thread.snippet}
                        </p>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          {!loading && (results?.posts.length ?? 0) > 0 && (
            <section>
              <p className="sticky top-0 border-b border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
                コメント
              </p>
              <ul>
                {results?.posts.map((post) => {
                  itemIndex += 1;
                  const currentIndex = itemIndex;
                  return (
                    <li key={post.id}>
                      <Link
                        id={`${listboxId}-option-${currentIndex}`}
                        href={`/threads/${post.threadId}#post-${post.id}`}
                        role="option"
                        aria-selected={activeIndex === currentIndex}
                        onMouseEnter={() => setActiveIndex(currentIndex)}
                        onClick={() => setOpen(false)}
                        className={`block px-4 py-2.5 transition ${rowClass(currentIndex)}`}
                      >
                        <p className="truncate text-xs text-neutral-500">
                          {post.threadTitle}
                        </p>
                        <p className="truncate text-sm text-neutral-200">
                          {post.snippet}
                        </p>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          {!loading && (results?.reviews.length ?? 0) > 0 && (
            <section>
              <p className="sticky top-0 border-b border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
                レビュー
              </p>
              <ul>
                {results?.reviews.map((review) => {
                  itemIndex += 1;
                  const currentIndex = itemIndex;
                  return (
                    <li key={review.id}>
                      <Link
                        id={`${listboxId}-option-${currentIndex}`}
                        href={`/albums/${review.albumId}#review-${review.id}`}
                        role="option"
                        aria-selected={activeIndex === currentIndex}
                        onMouseEnter={() => setActiveIndex(currentIndex)}
                        onClick={() => setOpen(false)}
                        className={`block px-4 py-2.5 transition ${rowClass(currentIndex)}`}
                      >
                        <p className="truncate text-sm font-medium text-neutral-100">
                          {review.albumTitle}
                        </p>
                        <p className="truncate text-xs text-neutral-500">
                          {review.snippet}
                        </p>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          {!loading && (results?.artists.length ?? 0) > 0 && (
            <section>
              <p className="sticky top-0 border-b border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
                アーティスト
              </p>
              <ul>
                {results?.artists.map((artist) => {
                  itemIndex += 1;
                  const currentIndex = itemIndex;
                  const imageSrc = artistImageSrc(artist);

                  return (
                    <li key={artist.id}>
                      <Link
                        id={`${listboxId}-option-${currentIndex}`}
                        href={`/artists/${artist.id}`}
                        role="option"
                        aria-selected={activeIndex === currentIndex}
                        onMouseEnter={() => setActiveIndex(currentIndex)}
                        onClick={() => setOpen(false)}
                        className={`flex items-center gap-3 px-4 py-2.5 transition ${rowClass(currentIndex)}`}
                      >
                        <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full bg-[var(--surface-raised)] ring-1 ring-[var(--border)]">
                          {imageSrc ? (
                            <Image
                              src={imageSrc}
                              alt=""
                              fill
                              className="object-cover"
                              sizes="40px"
                            />
                          ) : null}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-neutral-100">
                            {artist.name}
                          </p>
                          {artist.nameEn && (
                            <p className="truncate text-xs text-neutral-500">
                              {artist.nameEn}
                            </p>
                          )}
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          {!loading && (results?.albums.length ?? 0) > 0 && (
            <section>
              <p className="sticky top-0 border-b border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
                アルバム
              </p>
              <ul>
                {results?.albums.map((album) => {
                  itemIndex += 1;
                  const currentIndex = itemIndex;
                  const imageSrc = coverSrc(album);

                  return (
                    <li key={album.id}>
                      <Link
                        id={`${listboxId}-option-${currentIndex}`}
                        href={`/albums/${album.id}`}
                        role="option"
                        aria-selected={activeIndex === currentIndex}
                        onMouseEnter={() => setActiveIndex(currentIndex)}
                        onClick={() => setOpen(false)}
                        className={`flex items-center gap-3 px-4 py-2.5 transition ${rowClass(currentIndex)}`}
                      >
                        <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-md bg-[var(--surface-raised)] ring-1 ring-[var(--border)]">
                          {imageSrc ? (
                            <Image
                              src={imageSrc}
                              alt=""
                              fill
                              className="object-cover"
                              sizes="40px"
                            />
                          ) : null}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-neutral-100">
                            {album.title}
                          </p>
                          <p className="truncate text-xs text-neutral-500">
                            {album.artistName}
                            {album.artistNameEn ? ` · ${album.artistNameEn}` : ""}
                            {" · "}
                            {album.year}
                          </p>
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          {!loading && trimmedQuery.length > 0 && (
            <div className="border-t border-[var(--border)] px-4 py-2.5">
              <button
                type="button"
                onClick={() => goToSearchPage(trimmedQuery)}
                className="w-full text-left text-sm text-amber-300 transition hover:text-amber-200"
              >
                「{trimmedQuery}」のすべての結果を見る →
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
