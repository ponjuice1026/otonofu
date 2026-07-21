import Link from "next/link";
import { ArtistCard } from "@/components/artist/ArtistCard";
import { getAlbumCountsByArtistId, getArtists } from "@/lib/data/artists";
import { pageTitle } from "@/lib/site";

export const metadata = {
  title: pageTitle("アーティスト"),
};

export const dynamic = "force-dynamic";

export default async function ArtistsPage() {
  const [artists, releaseCounts] = await Promise.all([
    getArtists(),
    getAlbumCountsByArtistId(),
  ]);

  return (
    <div className="page-shell">
      <header className="page-header">
        <h1 className="page-title">アーティスト</h1>
        <p className="page-desc">
          収録アーティストを名前順にブラウズできます。作品から探すなら
          <Link href="/albums" className="link-accent hover:underline">
            アルバム
          </Link>
          へ。
        </p>
      </header>

      <section>
        <div className="section-header">
          <div>
            <h2 className="section-title">すべてのアーティスト</h2>
            <p className="section-desc">名前順</p>
          </div>
          <Link href="/albums" className="link-accent hover:underline">
            アルバムを見る →
          </Link>
        </div>

        {artists.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {artists.map((artist) => (
              <ArtistCard
                key={artist.id}
                artist={artist}
                releaseCount={releaseCounts.get(artist.id) ?? 0}
              />
            ))}
          </div>
        ) : (
          <p className="empty-state">アーティストはまだいません。</p>
        )}
      </section>
    </div>
  );
}
