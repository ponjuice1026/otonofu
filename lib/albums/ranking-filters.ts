import type { Album } from "@/lib/types";

export type RankingPeriod = "all" | "week" | "month";

export type RankingSort = "rating" | "reviews";

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
];

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
  if (value === "reviews") return "reviews";
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

export function albumsPageHref(params: {
  page?: number;
  period?: RankingPeriod;
  category?: RankingCategory;
  sort?: RankingSort;
  hash?: string;
}): string {
  return rankingPageHref("/albums", params);
}

export function chartsPageHref(params: {
  period?: RankingPeriod;
  category?: RankingCategory;
  sort?: RankingSort;
  hash?: string;
}): string {
  return rankingPageHref("/charts", params);
}

export function rankingPageHref(
  basePath: "/albums" | "/charts",
  params: {
    page?: number;
    period?: RankingPeriod;
    category?: RankingCategory;
    sort?: RankingSort;
    hash?: string;
  },
): string {
  const search = new URLSearchParams();

  if (basePath === "/albums" && params.page && params.page > 1) {
    search.set("page", String(params.page));
  }
  if (params.period && params.period !== "all") {
    search.set("period", params.period);
  }
  if (params.category && params.category !== "all") {
    search.set("category", params.category);
  }
  if (params.sort && params.sort !== "rating") {
    search.set("sort", params.sort);
  }

  const query = search.toString();
  const hash = params.hash ? `#${params.hash}` : "";

  return query ? `${basePath}?${query}${hash}` : `${basePath}${hash}`;
}

export function rankingPeriodSince(period: Exclude<RankingPeriod, "all">): Date {
  const days = period === "week" ? 7 : 30;
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}
