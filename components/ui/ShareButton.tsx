"use client";

import { useState } from "react";

type ShareButtonProps = {
  url: string;
  title: string;
  compact?: boolean;
};

function resolveAbsoluteUrl(url: string): string {
  if (typeof window === "undefined") return url;
  try {
    return new URL(url, window.location.origin).toString();
  } catch {
    return url;
  }
}

export function ShareButton({ url, title, compact }: ShareButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    const absoluteUrl = resolveAbsoluteUrl(url);
    try {
      await navigator.clipboard.writeText(absoluteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // クリップボードAPIが使えない環境では何もしない
    }
  };

  const handleTweet = () => {
    const absoluteUrl = resolveAbsoluteUrl(url);
    const tweetUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(
      title,
    )}&url=${encodeURIComponent(absoluteUrl)}`;
    window.open(tweetUrl, "_blank", "noopener,noreferrer");
  };

  const handleNativeShare = () => {
    const absoluteUrl = resolveAbsoluteUrl(url);
    if (typeof navigator !== "undefined" && navigator.share) {
      navigator.share({ title, url: absoluteUrl }).catch(() => {
        // ユーザーによるキャンセル等は無視
      });
    }
  };

  const canNativeShare =
    typeof navigator !== "undefined" && Boolean(navigator.share);

  const buttonClass =
    "inline-flex items-center gap-1 text-xs text-[var(--muted)] transition-colors hover:text-[var(--foreground)] sm:text-sm";

  return (
    <div className="inline-flex items-center gap-3">
      {canNativeShare && (
        <button
          type="button"
          onClick={handleNativeShare}
          className={buttonClass}
          aria-label="共有"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-4 w-4 shrink-0"
            aria-hidden="true"
          >
            <circle cx="18" cy="5" r="3" />
            <circle cx="6" cy="12" r="3" />
            <circle cx="18" cy="19" r="3" />
            <path d="M8.59 13.51 15.42 17.49" />
            <path d="M15.41 6.51 8.59 10.49" />
          </svg>
          {!compact && <span>共有</span>}
        </button>
      )}

      <button
        type="button"
        onClick={handleCopy}
        className={buttonClass}
        aria-label="リンクをコピー"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-4 w-4 shrink-0"
          aria-hidden="true"
        >
          <rect x="9" y="9" width="11" height="11" rx="2" />
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
        </svg>
        {!compact && <span>{copied ? "コピーしました" : "リンクをコピー"}</span>}
      </button>
      {compact && copied && (
        <span className="text-xs text-[var(--muted)]" role="status">
          コピーしました
        </span>
      )}

      <button
        type="button"
        onClick={handleTweet}
        className={buttonClass}
        aria-label="Xでシェア"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="currentColor"
          className="h-4 w-4 shrink-0"
          aria-hidden="true"
        >
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
        </svg>
        {!compact && <span>Xでシェア</span>}
      </button>
    </div>
  );
}
