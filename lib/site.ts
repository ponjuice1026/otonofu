export const SITE_NAME = "オトノフ";

export const SITE_TAGLINE = "音楽のセッションコミュニティ";

export const SITE_DESCRIPTION =
  "オトノフ — アルバムやアーティストについて語り合える音楽セッション。レビューと評価もあわせて楽しめる。";

/**
 * サイトのベースURL（末尾スラッシュなし）。
 * SEO（sitemap / robots / OGP / RSS / JSON-LD）と認証リダイレクトの両方で使用する。
 * 本番では Vercel の URL を `NEXT_PUBLIC_SITE_URL` に設定すること。
 */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"
).replace(/\/+$/, "");

/** ベースURLと結合した絶対URLを返す。 */
export function siteUrl(path = "/"): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${SITE_URL}${normalized}`;
}

export function pageTitle(suffix?: string): string {
  return suffix ? `${suffix} | ${SITE_NAME}` : `${SITE_NAME} — ${SITE_TAGLINE}`;
}
