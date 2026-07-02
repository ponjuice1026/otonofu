export const SITE_NAME = "オトノフ";

export const SITE_TAGLINE = "音楽のセッションコミュニティ";

export const SITE_DESCRIPTION =
  "オトノフ — アルバムやアーティストについて語り合える音楽セッション。レビューと評価もあわせて楽しめる。";

export function pageTitle(suffix?: string): string {
  return suffix ? `${suffix} | ${SITE_NAME}` : `${SITE_NAME} — ${SITE_TAGLINE}`;
}
