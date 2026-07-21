import { isSpotifyConfigured } from "./env";

type TokenCache = {
  accessToken: string;
  expiresAt: number;
};

let tokenCache: TokenCache | null = null;
let lastRequestAt = 0;

const MAX_RETRIES = 8;
// 1回の 429 で待つ上限。これを超える Retry-After を返された場合は待たずに
// 即エラーにする。Spotify がクォータ超過で長い Retry-After を返している間は
// 何度リクエストしても通らず、待ち続けても同期は1件も進まないため。
// 呼び出し側（キュー同期）が failed として記録し、次回実行で再試行する。
const MAX_RETRY_WAIT_SEC = 30;
// 1リクエストあたりの 429 待機の合計上限。
const MAX_TOTAL_RETRY_WAIT_SEC = 90;
// fetch 自体のタイムアウト。未設定だとソケットが死んだまま無限に待つ。
const REQUEST_TIMEOUT_MS = 20_000;

export type SpotifyFetchOptions = {
  maxRetries?: number;
  maxRetryWaitSec?: number;
  maxTotalRetryWaitSec?: number;
};

function requestTimeoutMs(): number {
  const env = Number(process.env.SPOTIFY_REQUEST_TIMEOUT_MS);
  return Number.isFinite(env) && env > 0 ? env : REQUEST_TIMEOUT_MS;
}

function minRequestIntervalMs(): number {
  const env = Number(process.env.SPOTIFY_REQUEST_INTERVAL_MS);
  return Number.isFinite(env) && env >= 0 ? env : 900;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function throttleRequests(): Promise<void> {
  const interval = minRequestIntervalMs();
  const elapsed = Date.now() - lastRequestAt;
  if (elapsed < interval) {
    await sleep(interval - elapsed);
  }
  lastRequestAt = Date.now();
}

export async function getSpotifyAccessToken(): Promise<string> {
  if (!isSpotifyConfigured()) {
    throw new Error(
      "Spotify is not configured. Set SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET in .env.local",
    );
  }

  if (tokenCache && Date.now() < tokenCache.expiresAt - 60_000) {
    return tokenCache.accessToken;
  }

  await throttleRequests();

  const credentials = Buffer.from(
    `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`,
  ).toString("base64");

  const response = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
    cache: "no-store",
    signal: AbortSignal.timeout(requestTimeoutMs()),
  });

  if (!response.ok) {
    throw new Error(`Spotify token request failed: ${response.status}`);
  }

  const data = (await response.json()) as {
    access_token: string;
    expires_in: number;
  };

  tokenCache = {
    accessToken: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };

  return tokenCache.accessToken;
}

export function isSpotifyRateLimitError(message: string): boolean {
  return message.includes("429") || message.includes("Too many requests");
}

export async function spotifyFetch<T>(
  path: string,
  attempt = 0,
  options: SpotifyFetchOptions = {},
): Promise<T> {
  const maxRetries = options.maxRetries ?? MAX_RETRIES;
  const maxRetryWaitSec = options.maxRetryWaitSec ?? MAX_RETRY_WAIT_SEC;
  const maxTotalRetryWaitSec =
    options.maxTotalRetryWaitSec ?? MAX_TOTAL_RETRY_WAIT_SEC;

  const url = path.startsWith("http")
    ? path
    : `https://api.spotify.com/v1${path}`;

  let waitedSec = 0;

  for (let i = attempt; ; i += 1) {
    await throttleRequests();
    const token = await getSpotifyAccessToken();

    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
      signal: AbortSignal.timeout(requestTimeoutMs()),
    });

    if (response.status !== 429) {
      if (!response.ok) {
        const body = await response.text();
        throw new Error(`Spotify API error ${response.status}: ${body}`);
      }
      return (await response.json()) as T;
    }

    const header = Number(response.headers.get("Retry-After") ?? "5");
    const retryAfter = Number.isFinite(header) && header > 0 ? header : 5;

    // Retry-After が上限を超える／リトライ回数・待機予算を使い切った場合は
    // 待たずに投げる。ここで粘っても通らないので、呼び出し側に判断を返す。
    if (
      retryAfter > maxRetryWaitSec ||
      i >= maxRetries ||
      waitedSec + retryAfter > maxTotalRetryWaitSec
    ) {
      throw new Error(
        `Spotify API error 429: rate limited (Retry-After: ${retryAfter}s, ` +
          `attempts: ${i + 1}, waited: ${waitedSec}s)`,
      );
    }

    console.warn(
      `[Spotify] 429 — ${retryAfter}s 待機 (${i + 1}/${maxRetries}, 累計 ${waitedSec}s)`,
    );
    await sleep(retryAfter * 1000 + 500);
    waitedSec += retryAfter;
  }
}

export async function spotifyFetchForPage<T>(path: string): Promise<T> {
  return spotifyFetch<T>(path, 0, { maxRetries: 1, maxRetryWaitSec: 8 });
}

export function pickImage(
  images: { url: string }[],
  preferredSize: "small" | "large" = "large",
): string | null {
  if (images.length === 0) return null;
  return preferredSize === "small"
    ? images[images.length - 1]?.url ?? images[0].url
    : images[0]?.url ?? null;
}

export function formatDuration(ms: number): string {
  const minutes = Math.floor(ms / 60_000);
  const seconds = Math.floor((ms % 60_000) / 1000);
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}
