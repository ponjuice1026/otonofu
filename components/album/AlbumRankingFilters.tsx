import Link from "next/link";
import {
  RANKING_CATEGORY_OPTIONS,
  RANKING_PERIOD_OPTIONS,
  RANKING_SORT_OPTIONS,
  albumsPageHref,
  chartsPageHref,
  type RankingCategory,
  type RankingPeriod,
  type RankingSort,
} from "@/lib/albums/ranking-filters";

type AlbumRankingFiltersProps = {
  period: RankingPeriod;
  category: RankingCategory;
  sort: RankingSort;
  basePath?: "/albums" | "/charts";
};

export function AlbumRankingFilters({
  period,
  category,
  sort,
  basePath = "/charts",
}: AlbumRankingFiltersProps) {
  const hrefFor = (params: {
    period?: RankingPeriod;
    category?: RankingCategory;
    sort?: RankingSort;
  }) =>
    basePath === "/albums"
      ? albumsPageHref({ ...params, hash: "ranking" })
      : chartsPageHref({ ...params, hash: "ranking" });

  return (
    <div className="flex flex-col gap-3">
      <div>
        <p className="mb-2 text-xs font-medium uppercase tracking-wider text-neutral-500">
          並び替え
        </p>
        <div className="tab-group flex-wrap">
          {RANKING_SORT_OPTIONS.map((option) => (
            <Link
              key={option.value}
              href={hrefFor({
                period,
                category,
                sort: option.value,
              })}
              scroll={false}
              prefetch={false}
              aria-current={sort === option.value ? "page" : undefined}
              className={
                sort === option.value ? "tab-item tab-item-active" : "tab-item"
              }
            >
              {option.label}
            </Link>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-2 text-xs font-medium uppercase tracking-wider text-neutral-500">
          期間
        </p>
        <div className="tab-group flex-wrap">
          {RANKING_PERIOD_OPTIONS.map((option) => (
            <Link
              key={option.value}
              href={hrefFor({
                period: option.value,
                category,
                sort,
              })}
              scroll={false}
              prefetch={false}
              aria-current={period === option.value ? "page" : undefined}
              className={
                period === option.value ? "tab-item tab-item-active" : "tab-item"
              }
            >
              {option.label}
            </Link>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-2 text-xs font-medium uppercase tracking-wider text-neutral-500">
          ジャンル
        </p>
        <div className="tab-group flex-wrap">
          {RANKING_CATEGORY_OPTIONS.map((option) => (
            <Link
              key={option.value}
              href={hrefFor({
                period,
                category: option.value,
                sort,
              })}
              scroll={false}
              prefetch={false}
              aria-current={category === option.value ? "page" : undefined}
              className={
                category === option.value
                  ? "tab-item tab-item-active"
                  : "tab-item"
              }
            >
              {option.label}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
