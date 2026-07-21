import type { Album } from "@/lib/types";

export type RankingPeriod = "all" | "week" | "month";

/**
 * "newest" だけはランキングではなく全アルバムの新着順一覧を指す。
 * 旧 /albums ページを /charts に統合した際のタブとして残している。
 */
export type RankingSort = "rating" | "reviews" | "newest";

export type RankingCategory =
  | "all"
  | "japanese"
  | "western"
  | "classical"
  | "jazz";

export type ArtistRankingMeta = {
  origin: string;
  genres: string[];
};

export const RANKING_PERIOD_OPTIONS = [
  { value: "all" as const, label: "全期間" },
  { value: "week" as const, label: "1週間" },
  { value: "month" as const, label: "1ヶ月" },
];

export const RANKING_SORT_OPTIONS = [
  { value: "rating" as const, label: "評価順" },
  { value: "reviews" as const, label: "レビュー数順" },
  { value: "newest" as const, label: "新着順" },
];

/** 新着順は期間フィルタを持たない（全アルバムをリリース年の新しい順に並べるため）。 */
export function sortSupportsPeriod(sort: RankingSort): boolean {
  return sort !== "newest";
}

export const RANKING_CATEGORY_OPTIONS = [
  { value: "all" as const, label: "すべて" },
  { value: "japanese" as const, label: "邦楽" },
  { value: "western" as const, label: "洋楽" },
  { value: "classical" as const, label: "クラシック" },
  { value: "jazz" as const, label: "ジャズ" },
];

export const HOME_RANKING_LIMIT = 10;

const CLASSICAL_RE =
  /classical|classic|opera|orchestr|symphon|baroque|chamber|romantic era|neoclassical|クラシック/i;

const JAZZ_RE =
  /jazz|bebop|swing|hard bop|cool jazz|free jazz|smooth jazz|ジャズ/i;

const JAPANESE_RE =
  /j-?pop|j-?rock|j-?rap|j-?soul|j-?idol|japanese|city pop|anison|anime|visual kei|vocaloid|shibuya-kei|kayokyoku|enka|邦楽|ゲーム/i;

export function parseRankingPeriod(value: string | undefined): RankingPeriod {
  if (value === "week" || value === "month") return value;
  if (value === "year") return "month";
  return "all";
}

export function parseRankingSort(value: string | undefined): RankingSort {
  if (value === "reviews" || value === "newest") return value;
  return "rating";
}

export function parseRankingCategory(value: string | undefined): RankingCategory {
  if (
    value === "japanese" ||
    value === "western" ||
    value === "classical" ||
    value === "jazz"
  ) {
    return value;
  }
  return "all";
}

function genreBlob(
  album: Album,
  artist: ArtistRankingMeta | undefined,
): string {
  return [album.genre, ...(artist?.genres ?? []), artist?.origin ?? ""]
    .join(" ")
    .toLowerCase();
}

export function resolveRankingCategory(
  album: Album,
  artist: ArtistRankingMeta | undefined,
): Exclude<RankingCategory, "all"> {
  const blob = genreBlob(album, artist);

  if (CLASSICAL_RE.test(blob)) return "classical";
  if (JAZZ_RE.test(blob)) return "jazz";

  const isJapanese =
    (artist?.origin ?? "").includes("日本") ||
    (artist?.origin ?? "").toLowerCase().includes("japan") ||
    JAPANESE_RE.test(blob);

  if (isJapanese) return "japanese";
  return "western";
}

export function matchesRankingCategory(
  album: Album,
  artist: ArtistRankingMeta | undefined,
  category: RankingCategory,
): boolean {
  if (category === "all") return true;
  return resolveRankingCategory(album, artist) === category;
}

export function rankingPeriodLabel(period: RankingPeriod): string {
  return RANKING_PERIOD_OPTIONS.find((item) => item.value === period)?.label ?? "";
}

export function rankingSortLabel(sort: RankingSort): string {
  return RANKING_SORT_OPTIONS.find((item) => item.value === sort)?.label ?? "";
}

export function rankingCategoryLabel(category: RankingCategory): string {
  return (
    RANKING_CATEGORY_OPTIONS.find((item) => item.value === category)?.label ?? ""
  );
}

export type RankingPageParams = {
  page?: number;
  period?: RankingPeriod;
  category?: RankingCategory;
  sort?: RankingSort;
  hash?: string;
};

/**
 * ランキング（/charts）の URL を組み立てる。
 * 既定値（period=all / category=all / sort=rating / page=1）はクエリに出さない。
 */
export function chartsPageHref(params: RankingPageParams): string {
  const search = new URLSearchParams();

  if (params.sort && params.sort !== "rating") {
    search.set("sort", params.sort);
  }
  // 期間を持たない並び順では period を落とす。
  if (
    params.period &&
    params.period !== "all" &&
    sortSupportsPeriod(params.sort ?? "rating")
  ) {
    search.set("period", params.period);
  }
  if (params.category && params.category !== "all") {
    search.set("category", params.category);
  }
  if (params.page && params.page > 1) {
    search.set("page", String(params.page));
  }

  const query = search.toString();
  const hash = params.hash ? `#${params.hash}` : "";

  return query ? `/charts?${query}${hash}` : `/charts${hash}`;
}

export function rankingPeriodSince(period: Exclude<RankingPeriod, "all">): Date {
  const days = period === "week" ? 7 : 30;
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}
