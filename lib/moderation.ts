/**
 * 投稿本文の簡易モデレーション（スパム/荒らしの下地）。
 * 単語ブラックリスト自体は空（運用で追加）。
 * ここでは構造的なスパムパターン（URL 大量貼り付け・過度な繰り返し）を検査する。
 */

/**
 * 禁止単語パターン。運用で追加する想定。空でよい。
 * 例: /差別語/i など。
 */
export const BANNED_PATTERNS: RegExp[] = [];

/** 本文中に含めてよい URL の最大数。これを超えると弾く。 */
const MAX_URL_COUNT = 5;

/** 同一文字の連続の許容上限。これを超えると弾く（例: 「ああああ…」の連投荒らし）。 */
const MAX_REPEAT_RUN = 30;

const URL_REGEX = /https?:\/\/[^\s]+/gi;
// 同一文字が MAX_REPEAT_RUN+1 回以上連続するパターン
const EXCESSIVE_REPEAT_REGEX = new RegExp(`(.)\\1{${MAX_REPEAT_RUN}}`, "u");

/**
 * 本文を検査し、問題があれば日本語エラーメッセージを返す。
 * 問題なければ null。
 */
export function checkContent(body: string): string | null {
  const text = body ?? "";

  // 禁止単語
  for (const pattern of BANNED_PATTERNS) {
    if (pattern.test(text)) {
      return "投稿できない内容が含まれています。";
    }
  }

  // URL の貼り付けすぎ
  const urls = text.match(URL_REGEX);
  if (urls && urls.length > MAX_URL_COUNT) {
    return "URL が多すぎます。数を減らして再度お試しください。";
  }

  // 過度な繰り返し文字
  if (EXCESSIVE_REPEAT_REGEX.test(text)) {
    return "同じ文字の繰り返しが多すぎます。内容を見直してください。";
  }

  return null;
}
