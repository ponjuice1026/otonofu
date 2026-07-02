import { isSpotifyConfigured } from "./env";

type TokenCache = {
  accessToken: string;
  expiresAt: number;
};

let tokenCache: TokenCache | null = null;
let lastRequestAt = 0;

const MAX_RETRIES = 8;
const MAX_RETRY_WAIT_SEC = 180;

export type SpotifyFetchOptions = {
  maxRetries?: number;
  maxRetryWaitSec?: number;
};

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

  await throttleRequests();

  const token = await getSpotifyAccessToken();
  const url = path.startsWith("http")
    ? path
    : `https://api.spotify.com/v1${path}`;

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  if (response.status === 429 && attempt < maxRetries) {
    const retryAfter = Number(response.headers.get("Retry-After") ?? "5");
    const waitSec = Math.min(
      Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : 5,
      maxRetryWaitSec,
    );
    if (process.env.SPOTIFY_SYNC_VERBOSE === "1") {
      console.warn(
        `[Spotify] 429 — ${waitSec}s 待機 (${attempt + 1}/${maxRetries})`,
      );
    }
    await sleep(waitSec * 1000 + 500);
    return spotifyFetch<T>(path, attempt + 1, options);
  }

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Spotify API error ${response.status}: ${body}`);
  }

  return response.json() as Promise<T>;
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
