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
 *
 * これは「構造的スパム（URL 過多・繰り返し）＋コード内蔵の BANNED_PATTERNS」のみを
 * 検査する同期の純関数。DB 管理の NG ワードは含まない（副作用を持たせないため）。
 * DB の NG ワードは Server Action 側で getBannedWords() → matchesBannedWords() を
 * 併用するか、checkContentWithWords() を使うこと。
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

/**
 * DB 管理の NG ワード 1 件を表す。
 * - pattern: 照合対象の文字列。is_regex=true のとき正規表現ソース。
 * - is_regex: true なら正規表現(大文字小文字無視)で照合。false なら部分一致(大文字小文字無視)。
 */
export type BannedWord = {
  pattern: string;
  is_regex?: boolean | null;
};

/**
 * 本文が DB の NG ワードのいずれかに一致するか判定する純関数。
 * - 通常語: 大文字小文字を無視した部分一致。
 * - 正規表現: `i` フラグ付きで test。不正な正規表現は無視（他の語の判定は継続）。
 * DB 側 otonofu_assert_content_ok の照合（ilike / ~*）とロジックを揃える。
 */
export function matchesBannedWords(
  body: string,
  words: readonly BannedWord[],
): boolean {
  const text = body ?? "";
  if (!text) return false;

  const lower = text.toLowerCase();

  for (const word of words) {
    const pattern = word.pattern?.trim();
    if (!pattern) continue;

    if (word.is_regex) {
      try {
        if (new RegExp(word.pattern, "iu").test(text)) return true;
      } catch {
        // 不正な正規表現はスキップ（運用ミスで全投稿を止めないため）。
      }
    } else if (lower.includes(pattern.toLowerCase())) {
      return true;
    }
  }

  return false;
}

/**
 * 構造チェック（checkContent）に加えて、DB の NG ワード照合を行う非同期不要の
 * 純関数版。Server Action で「DB からワード取得 → 本文照合」を一度に行いたい場合に使う。
 * 問題があれば日本語メッセージ、無ければ null。
 */
export function checkContentWithWords(
  body: string,
  words: readonly BannedWord[],
): string | null {
  const structural = checkContent(body);
  if (structural) return structural;

  if (matchesBannedWords(body, words)) {
    return "投稿できない内容が含まれています。";
  }

  return null;
}
