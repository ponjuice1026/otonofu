// PostgREST の or() / ilike フィルタに埋め込むユーザー入力を安全化する。
//
// 背景（脆弱性）:
//   supabase-js の .or(`title.ilike.%${q}%,body.ilike.%${q}%`) のように
//   ユーザー入力を直接埋め込むと、以下の問題が起きる:
//     1. フィルタ構文の注入 — `,`（条件区切り）や `(` `)`（論理グループ）を
//        含む検索語で or() の構文が壊れ、意図しない条件が挿入される。
//     2. ワイルドカード注入 — `%` `_` が LIKE のワイルドカードとして解釈され、
//        検索語の意味が変わる（例: 「50%」が任意文字列にマッチ）。
//
// 対策:
//   - ワイルドカード `%` `_` と、エスケープ文字 `\` をバックスラッシュで
//     エスケープする（ilike のパターン内リテラル化）。
//   - PostgREST の予約文字（`,` `.` `:` `(` `)` 空白 等）を含む値は、
//     PostgREST のダブルクォート記法 `"..."` で値全体を包む。
//     クォート内部の `"` と `\` はさらにエスケープする。
//
// これを ilike のパターン（`%...%`）に組み込み、or() 文字列を組み立てる。

// PostgREST が値のクォートを必要とする予約文字。
// カンマ（条件区切り）・丸括弧（論理グループ）・ドット（演算子区切り）・
// コロン・空白類など、クォートしないと構文の一部と解釈されうる文字。
const POSTGREST_RESERVED_RE = /[,.:()"\\{}\s]/;

/**
 * ilike のパターン内でリテラル扱いにすべき文字をエスケープする。
 * バックスラッシュ自身・`%`・`_` を `\` でエスケープする。
 * （バックスラッシュを最初に処理して二重エスケープを防ぐ）
 */
export function escapeLikePattern(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/%/g, "\\%")
    .replace(/_/g, "\\_");
}

/**
 * PostgREST の or()/フィルタ値として安全な文字列を返す。
 * 予約文字を含む場合はダブルクォートで包み、内部の `"` と `\` を
 * バックスラッシュでエスケープする。含まない場合はそのまま返す。
 */
export function quotePostgrestValue(value: string): string {
  if (!POSTGREST_RESERVED_RE.test(value)) {
    return value;
  }
  const escaped = value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  return `"${escaped}"`;
}

/**
 * ユーザー入力を ilike の「中間一致」パターン（`%...%`）にし、
 * or() フィルタ値として安全化して返す。
 *
 * 例: buildIlikeContainsFilter("title", "a,b%") で
 *     PostgREST 予約文字を含むためクォートされた
 *     `title.ilike."%a,b\%%"` 相当を返す。
 */
export function buildIlikeContainsFilter(column: string, value: string): string {
  const pattern = `%${escapeLikePattern(value)}%`;
  return `${column}.ilike.${quotePostgrestValue(pattern)}`;
}

/**
 * 複数カラムに対する ilike 中間一致を or() 文字列に組み立てる。
 * 例: buildIlikeOrFilter(["title", "body"], q)
 */
export function buildIlikeOrFilter(columns: string[], value: string): string {
  return columns.map((column) => buildIlikeContainsFilter(column, value)).join(",");
}
