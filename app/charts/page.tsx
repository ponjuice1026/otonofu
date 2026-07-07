import { AlbumRankingList } from "@/components/album/AlbumRankingList";
import { AlbumRankingFilters } from "@/components/album/AlbumRankingFilters";
import { AlbumCard } from "@/components/album/AlbumCard";
import {
  rankingCategoryLabel,
  rankingPeriodLabel,
  rankingSortLabel,
  parseRankingCategory,
  parseRankingPeriod,
  parseRankingSort,
} from "@/lib/albums/ranking-filters";
import { getUser } from "@/lib/auth/session";
import { getRankedAlbums, getRecommendedAlbums } from "@/lib/data/albums";
import { getArtistNameMapForIds } from "@/lib/data/artists";
import { pageTitle, siteUrl } from "@/lib/site";

const CHARTS_DESCRIPTION =
  "オトノフのアルバムランキング。ユーザー評価の高いアルバムや期間・ジャンル別の人気作をチェックできる。";

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
    category?: string;
    sort?: string;
  }>;
};

export default async function ChartsPage({ searchParams }: PageProps) {
  const {
    period: periodParam,
    category: categoryParam,
    sort: sortParam,
  } = await searchParams;
  const period = parseRankingPeriod(periodParam);
  const category = parseRankingCategory(categoryParam);
  const sort = parseRankingSort(sortParam);

  const user = await getUser();
  const ranked = await getRankedAlbums({
    limit: RANKING_LIMIT,
    period,
    category,
    sort,
  });
  const rankedIds = ranked.map((album) => album.id);
  const recommendedAlbums = await getRecommendedAlbums(
    user?.id ?? null,
    RECOMMENDED_ALBUMS_LIMIT,
    rankedIds,
  );

  const artistIds = [
    ...new Set([
      ...ranked.map((album) => album.artistId),
      ...recommendedAlbums.map((album) => album.artistId),
    ]),
  ];
  const artistNames = await getArtistNameMapForIds(artistIds);

  const rankingDesc =
    period === "all" && category === "all" && sort === "rating"
      ? "ユーザー評価の高いアルバム"
      : [
          period !== "all" ? `${rankingPeriodLabel(period)}の評価` : null,
          category !== "all" ? rankingCategoryLabel(category) : null,
          rankingSortLabel(sort),
        ]
          .filter(Boolean)
          .join(" · ");

  return (
    <div className="page-shell">
      <header className="page-header">
        <h1 className="page-title">ランキング</h1>
        <p className="page-desc">ユーザー評価の高いアルバムとおすすめ</p>
      </header>

      <section id="ranking" className="mb-14 scroll-mt-8">
        <div className="section-header">
          <div>
            <h2 className="section-title">評価ランキング</h2>
            <p className="section-desc">{rankingDesc}</p>
          </div>
        </div>

        <div className="mb-5">
          <AlbumRankingFilters
            period={period}
            category={category}
            sort={sort}
            basePath="/charts"
          />
        </div>

        {ranked.length > 0 ? (
          <AlbumRankingList albums={ranked} artistNames={artistNames} />
        ) : (
          <p className="empty-state">
            条件に合うランキングはまだありません。フィルターを変えてお試しください。
          </p>
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
