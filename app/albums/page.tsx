import Link from "next/link";
import { AlbumCard } from "@/components/album/AlbumCard";
import { AlbumPagination } from "@/components/album/AlbumPagination";
import { albumsPageHref } from "@/lib/albums/ranking-filters";
import { getUser } from "@/lib/auth/session";
import {
  ALBUMS_PAGE_SIZE,
  getAlbumCount,
  getAlbumsPage,
  getRecommendedAlbums,
} from "@/lib/data/albums";
import { getArtistNameMapForIds } from "@/lib/data/artists";
import { pageTitle } from "@/lib/site";

export const metadata = {
  title: pageTitle("アルバム"),
};

export const dynamic = "force-dynamic";

const RECOMMENDED_ALBUMS_LIMIT = 5;

type PageProps = {
  searchParams: Promise<{
    page?: string;
  }>;
};

function parsePage(value: string | undefined): number {
  const parsed = Number.parseInt(value ?? "1", 10);
  if (!Number.isFinite(parsed) || parsed < 1) return 1;
  return parsed;
}

export default async function AlbumsPage({ searchParams }: PageProps) {
  const { page: pageParam } = await searchParams;
  const page = parsePage(pageParam);

  const user = await getUser();
  const [albums, totalCount] = await Promise.all([
    getAlbumsPage(page),
    getAlbumCount(),
  ]);

  const albumIds = albums.map((album) => album.id);
  const recommendedAlbums = await getRecommendedAlbums(
    user?.id ?? null,
    RECOMMENDED_ALBUMS_LIMIT,
    albumIds,
  );

  const artistIds = [
    ...new Set([
      ...albums.map((album) => album.artistId),
      ...recommendedAlbums.map((album) => album.artistId),
    ]),
  ];
  const artistNames = await getArtistNameMapForIds(artistIds);

  return (
    <div className="page-shell">
      <header className="page-header">
        <h1 className="page-title">アルバム</h1>
        <p className="page-desc">
          収録アルバムを新しい順にブラウズできます。評価順に見るなら
          <Link href="/charts" className="link-accent hover:underline">
            ランキング
          </Link>
          へ。
        </p>
      </header>

      <section className="mb-14">
        <div className="section-header">
          <div>
            <h2 className="section-title">すべてのアルバム</h2>
            <p className="section-desc">リリース年の新しい順</p>
          </div>
          <Link href="/charts" className="link-accent hover:underline">
            評価ランキングを見る →
          </Link>
        </div>

        {albums.length > 0 ? (
          <>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
              {albums.map((album) => (
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
              hrefForPage={(target) => albumsPageHref({ page: target })}
            />
          </>
        ) : (
          <p className="empty-state">アルバムはまだありません。</p>
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
