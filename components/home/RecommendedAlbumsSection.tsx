import Link from "next/link";
import { AlbumCard } from "@/components/album/AlbumCard";
import { getRecommendedAlbums } from "@/lib/data/albums";
import { getArtistNameMapForIds } from "@/lib/data/artists";

type Props = {
  userId: string | null;
  /** ランキング欄に出したアルバムID（おすすめから除外して重複を避ける） */
  excludeAlbumIds: string[];
  limit?: number;
};

/**
 * ホーム最下部の「おすすめのアルバム」セクション。
 *
 * ログイン時は getRecommendedAlbums が interest 収集（reviews/track_ratings）
 * を伴うため、独立した async サーバコンポーネントに切り出し <Suspense> で
 * ストリームさせる。フォールドより下のため初期描画をブロックする必要はない。
 */
export async function RecommendedAlbumsSection({
  userId,
  excludeAlbumIds,
  limit = 5,
}: Props) {
  const recommendedAlbums = await getRecommendedAlbums(
    userId,
    limit,
    excludeAlbumIds,
  );
  const artistIds = [
    ...new Set(recommendedAlbums.map((album) => album.artistId)),
  ];
  const artistNames = await getArtistNameMapForIds(artistIds);

  return (
    <section className="home-section">
      <div className="section-header">
        <div>
          <h2 className="section-title section-title-accent section-accent-amber">
            おすすめのアルバム
          </h2>
          <p className="section-desc">
            {userId
              ? "あなたの評価履歴から選んだおすすめ"
              : "評価の高いアルバムからピックアップ"}
          </p>
        </div>
        <Link href="/charts" className="link-accent hover:underline">
          すべて見る →
        </Link>
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
  );
}
