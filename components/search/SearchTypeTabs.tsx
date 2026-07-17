import Link from "next/link";
import {
  SEARCH_TYPE_OPTIONS,
  searchTypeHref,
  type SearchType,
  type SingleSearchType,
} from "@/lib/search/search-type";

type SearchTypeTabsProps = {
  query: string;
  activeType: SearchType;
  /** タイプ別の件数（取得できた範囲のみ）。バッジ表示に使う。 */
  counts?: Partial<Record<SingleSearchType, number>>;
};

/**
 * 検索結果の絞り込みタブ。すべて / アルバム / アーティスト / セッション /
 * コメント / レビュー。件数が分かるタイプはバッジを添える。
 */
export function SearchTypeTabs({
  query,
  activeType,
  counts,
}: SearchTypeTabsProps) {
  return (
    <div className="tab-group mb-8 flex-wrap">
      {SEARCH_TYPE_OPTIONS.map((option) => {
        const active = option.value === activeType;
        const count =
          option.value === "all"
            ? undefined
            : counts?.[option.value as SingleSearchType];

        return (
          <Link
            key={option.value}
            href={searchTypeHref(query, option.value)}
            aria-current={active ? "page" : undefined}
            className={active ? "tab-item tab-item-active" : "tab-item"}
          >
            {option.label}
            {typeof count === "number" && count > 0 && (
              <span className="ml-1.5 text-xs text-[var(--muted)]">{count}</span>
            )}
          </Link>
        );
      })}
    </div>
  );
}
