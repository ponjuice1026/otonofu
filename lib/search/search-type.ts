/**
 * 検索結果ページのタブ（絞り込み対象タイプ）を表す純粋な型・ヘルパー。
 * "all" は全タイプ横断の要約表示、それ以外は単一タイプの深掘り表示。
 */

export type SearchType =
  | "all"
  | "albums"
  | "artists"
  | "threads"
  | "posts"
  | "reviews";

/** "all" を除いた単一タイプ。SiteSearchResult のキーと一致する。 */
export type SingleSearchType = Exclude<SearchType, "all">;

export const SEARCH_TYPE_OPTIONS: { value: SearchType; label: string }[] = [
  { value: "all", label: "すべて" },
  { value: "albums", label: "アルバム" },
  { value: "artists", label: "アーティスト" },
  { value: "threads", label: "セッション" },
  { value: "posts", label: "コメント" },
  { value: "reviews", label: "レビュー" },
];

const SINGLE_SEARCH_TYPES: SingleSearchType[] = [
  "albums",
  "artists",
  "threads",
  "posts",
  "reviews",
];

/** 「すべて」ビューで各セクションが表示する上限件数。 */
export const SEARCH_SECTION_LIMIT = 12;

/** 単一タイプ絞り込みビューで表示する上限件数。 */
export const SEARCH_TYPE_LIMIT = 40;

/** クエリ文字列から検索タイプを解釈する（不正値・未指定は "all"）。 */
export function parseSearchType(value: string | undefined): SearchType {
  if (value && (SINGLE_SEARCH_TYPES as string[]).includes(value)) {
    return value as SingleSearchType;
  }
  return "all";
}

export function searchTypeLabel(type: SearchType): string {
  return SEARCH_TYPE_OPTIONS.find((option) => option.value === type)?.label ?? "";
}

/** /search への href（q と type を組み立てる。type=all は type を省略）。 */
export function searchTypeHref(query: string, type: SearchType): string {
  const params = new URLSearchParams();
  params.set("q", query);
  if (type !== "all") params.set("type", type);
  return `/search?${params.toString()}`;
}
