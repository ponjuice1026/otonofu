import Link from "next/link";
import { SearchForm } from "@/components/search/SearchForm";
import { SearchResults } from "@/components/search/SearchResults";
import { SearchTypeTabs } from "@/components/search/SearchTypeTabs";
import {
  searchCatalog,
  searchCatalogByType,
  siteSearchTotal,
  type SiteSearchResult,
} from "@/lib/data/search";
import {
  parseSearchType,
  SEARCH_SECTION_LIMIT,
  SEARCH_TYPE_LIMIT,
  type SingleSearchType,
} from "@/lib/search/search-type";
import { pageTitle } from "@/lib/site";

export const metadata = {
  title: pageTitle("検索"),
};

export const dynamic = "force-dynamic";

type SearchPageProps = {
  searchParams: Promise<{ q?: string; type?: string }>;
};

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const { q, type: typeParam } = await searchParams;
  const query = q?.trim() ?? "";
  const type = parseSearchType(typeParam);

  let results: SiteSearchResult | null = null;
  if (query) {
    results =
      type === "all"
        ? await searchCatalog(query, SEARCH_SECTION_LIMIT)
        : await searchCatalogByType(query, type, SEARCH_TYPE_LIMIT);
  }

  const total = results ? siteSearchTotal(results) : 0;

  // タブのバッジ用件数。「すべて」ビューでは全タイプ、単一タイプビューでは
  // その 1 タイプのみ件数が分かる（取得できた範囲で表示する）。
  let counts: Partial<Record<SingleSearchType, number>> | undefined;
  if (results) {
    if (type === "all") {
      counts = {
        albums: results.albums.length,
        artists: results.artists.length,
        threads: results.threads.length,
        posts: results.posts.length,
        reviews: results.reviews.length,
      };
    } else {
      const single: Partial<Record<SingleSearchType, number>> = {};
      single[type] = results[type].length;
      counts = single;
    }
  }

  return (
    <div className="page-shell">
      <header className="page-header">
        <h1 className="page-title">検索</h1>
        <p className="page-desc">
          キーワードでセッション、コメント、レビュー、アーティスト、アルバムを探せます。
        </p>
      </header>

      <SearchForm initialQuery={query} />

      {query && (
        <SearchTypeTabs query={query} activeType={type} counts={counts} />
      )}

      {!query ? (
        <p className="text-sm text-neutral-500">
          探したい言葉を入力して検索してください。
        </p>
      ) : total === 0 ? (
        <div className="empty-state">
          <p>「{query}」に一致する結果は見つかりませんでした。</p>
          <p className="mt-3 text-sm">
            <Link
              href={`/contribute?type=add_album&q=${encodeURIComponent(query)}`}
              className="link-accent hover:underline"
            >
              見つからない作品の追加をリクエストする →
            </Link>
          </p>
        </div>
      ) : (
        <SearchResults
          query={query}
          results={results!}
          moreLinkLimit={type === "all" ? SEARCH_SECTION_LIMIT : undefined}
        />
      )}
    </div>
  );
}
