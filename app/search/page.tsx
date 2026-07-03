import Link from "next/link";
import { SearchForm } from "@/components/search/SearchForm";
import { SearchResults } from "@/components/search/SearchResults";
import { searchCatalog, siteSearchTotal } from "@/lib/data/search";
import { pageTitle } from "@/lib/site";

export const metadata = {
  title: pageTitle("検索"),
};

export const dynamic = "force-dynamic";

type SearchPageProps = {
  searchParams: Promise<{ q?: string }>;
};

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const { q } = await searchParams;
  const query = q?.trim() ?? "";
  const results = query ? await searchCatalog(query, 12) : null;
  const total = results ? siteSearchTotal(results) : 0;

  return (
    <div className="page-shell">
      <header className="page-header">
        <h1 className="page-title">検索</h1>
        <p className="page-desc">
          キーワードでセッション、コメント、レビュー、アーティスト、アルバムを探せます。
        </p>
      </header>

      <SearchForm initialQuery={query} />

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
        <SearchResults query={query} results={results!} />
      )}
    </div>
  );
}
