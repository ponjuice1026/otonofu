import { AlbumRankingList } from "@/components/album/AlbumRankingList";
import { AlbumRankingFilters } from "@/components/album/AlbumRankingFilters";
import { AlbumCard } from "@/components/album/AlbumCard";
import { AlbumPagination } from "@/components/album/AlbumPagination";
import {
  chartsPageHref,
  rankingPeriodLabel,
  rankingSortLabel,
  parseRankingPeriod,
  parseRankingSort,
} from "@/lib/albums/ranking-filters";
import { getUser } from "@/lib/auth/session";
import {
  ALBUMS_PAGE_SIZE,
  getAlbumCount,
  getAlbumsPage,
  getRankedAlbums,
  getRecommendedAlbums,
} from "@/lib/data/albums";
import { getArtistNameMapForIds } from "@/lib/data/artists";
import { pageTitle, siteUrl } from "@/lib/site";

const CHARTS_DESCRIPTION =
  "オトノフのアルバムランキング。ユーザー評価の高いアルバムや期間別の人気作、新着アルバムをチェックできる。";

export const metadata = {
  title: pageTitle("ランキング"),
  description: CHARTS_DESCRIPTION,
  alternates: { canonical: siteUrl("/charts") },
  openGraph: {
    title: pageTitle("ランキング"),
    description: CHARTS_DESCRIPTION,
    url: siteUrl("/charts"),
  },
};

export const dynamic = "force-dynamic";

const RANKING_LIMIT = 50;
const RECOMMENDED_ALBUMS_LIMIT = 10;

type PageProps = {
  searchParams: Promise<{
    period?: string;
    sort?: string;
    page?: string;
  }>;
};

function parsePage(value: string | undefined): number {
  const parsed = Number.parseInt(value ?? "1", 10);
  if (!Number.isFinite(parsed) || parsed < 1) return 1;
  return parsed;
}

export default async function ChartsPage({ searchParams }: PageProps) {
  const {
    period: periodParam,
    sort: sortParam,
    page: pageParam,
  } = await searchParams;
  const period = parseRankingPeriod(periodParam);
  const sort = parseRankingSort(sortParam);
  const page = parsePage(pageParam);

  // 新着順は全アルバムをリリース年順にページ送りする（旧 /albums の一覧）。
  // それ以外は評価/レビュー数のランキング。
  const isNewest = sort === "newest";

  const user = await getUser();
  const [listedAlbums, totalCount] = isNewest
    ? await Promise.all([getAlbumsPage(page), getAlbumCount()])
    : [await getRankedAlbums({ limit: RANKING_LIMIT, period, sort }), 0];

  const listedIds = listedAlbums.map((album) => album.id);
  const recommendedAlbums = await getRecommendedAlbums(
    user?.id ?? null,
    RECOMMENDED_ALBUMS_LIMIT,
    listedIds,
  );

  const artistIds = [
    ...new Set([
      ...listedAlbums.map((album) => album.artistId),
      ...recommendedAlbums.map((album) => album.artistId),
    ]),
  ];
  const artistNames = await getArtistNameMapForIds(artistIds);

  const rankingDesc = isNewest
    ? "リリース年の新しい順"
    : period === "all" && sort === "rating"
      ? "ユーザー評価の高いアルバム"
      : [
          period !== "all" ? `${rankingPeriodLabel(period)}の評価` : null,
          rankingSortLabel(sort),
        ]
          .filter(Boolean)
          .join(" · ");

  return (
    <div className="page-shell">
      <header className="page-header">
        <h1 className="page-title">ランキング</h1>
        <p className="page-desc">
          ユーザー評価の高いアルバムと、すべてのアルバム
        </p>
      </header>

      <section id="ranking" className="mb-14 scroll-mt-8">
        <div className="section-header">
          <div>
            <h2 className="section-title">
              {isNewest ? "すべてのアルバム" : "評価ランキング"}
            </h2>
            <p className="section-desc">{rankingDesc}</p>
          </div>
        </div>

        <div className="mb-5">
          <AlbumRankingFilters period={period} sort={sort} />
        </div>

        {listedAlbums.length === 0 ? (
          <p className="empty-state">
            {isNewest
              ? "アルバムはまだありません。"
              : "条件に合うランキングはまだありません。フィルターを変えてお試しください。"}
          </p>
        ) : isNewest ? (
          <>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
              {listedAlbums.map((album) => (
                <AlbumCard
                  key={album.id}
                  album={album}
                  artistName={artistNames.get(album.artistId)}
                />
              ))}
            </div>
            <AlbumPagination
              currentPage={page}
              totalCount={totalCount}
              pageSize={ALBUMS_PAGE_SIZE}
              hrefForPage={(target) =>
                chartsPageHref({ sort, page: target, hash: "ranking" })
              }
            />
          </>
        ) : (
          <AlbumRankingList albums={listedAlbums} artistNames={artistNames} />
        )}
      </section>

      <section>
        <div className="section-header">
          <div>
            <h2 className="section-title">おすすめのアルバム</h2>
            <p className="section-desc">
              {user
                ? "あなたの評価履歴から選んだおすすめ"
                : "評価の高いアルバムからピックアップ"}
            </p>
          </div>
        </div>
        {recommendedAlbums.length > 0 ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-5">
            {recommendedAlbums.map((album) => (
              <AlbumCard
                key={album.id}
                album={album}
                artistName={artistNames.get(album.artistId)}
              />
            ))}
          </div>
        ) : (
          <p className="empty-state">おすすめのアルバムはまだありません。</p>
        )}
      </section>
    </div>
  );
}
