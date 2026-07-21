import Link from "next/link";
import {
  RANKING_PERIOD_OPTIONS,
  RANKING_SORT_OPTIONS,
  albumsPageHref,
  chartsPageHref,
  type RankingPeriod,
  type RankingSort,
} from "@/lib/albums/ranking-filters";

type AlbumRankingFiltersProps = {
  period: RankingPeriod;
  sort: RankingSort;
  basePath?: "/albums" | "/charts";
};

export function AlbumRankingFilters({
  period,
  sort,
  basePath = "/charts",
}: AlbumRankingFiltersProps) {
  const hrefFor = (params: { period?: RankingPeriod; sort?: RankingSort }) =>
    basePath === "/albums"
      ? albumsPageHref({ ...params, hash: "ranking" })
      : chartsPageHref({ ...params, hash: "ranking" });

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <p className="shrink-0 text-[11px] font-medium uppercase tracking-wider text-neutral-500">
          並び替え
        </p>
        <div className="tab-group flex-wrap">
          {RANKING_SORT_OPTIONS.map((option) => (
            <Link
              key={option.value}
              href={hrefFor({ period, sort: option.value })}
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

      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <p className="shrink-0 text-[11px] font-medium uppercase tracking-wider text-neutral-500">
          期間
        </p>
        <div className="tab-group flex-wrap">
          {RANKING_PERIOD_OPTIONS.map((option) => (
            <Link
              key={option.value}
              href={hrefFor({ period: option.value, sort })}
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
    </div>
  );
}
