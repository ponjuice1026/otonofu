import Link from "next/link";
import { AlbumCover } from "@/components/spotify/AlbumCover";
import { getGenreSummaries } from "@/lib/data/genres";
import { pageTitle } from "@/lib/site";

export const metadata = {
  title: pageTitle("ジャンル"),
};

// ジャンル一覧は auth 非依存の公開データ（getGenreSummaries はユーザー個別表示・
// cookie を一切参照しない）。集計が変わる頻度は低いため 5 分の ISR に置く。
export const revalidate = 300;

function coverSrc(cover: {
  coverUrl?: string;
  spotifyId?: string;
}): string | undefined {
  if (cover.coverUrl) return cover.coverUrl;
  if (cover.spotifyId) return `/api/covers/album/${cover.spotifyId}`;
  return undefined;
}

export default async function GenresPage() {
  const summaries = await getGenreSummaries();

  return (
    <div className="page-shell">
      <header className="page-header">
        <h1 className="page-title">ジャンル</h1>
        <p className="page-desc">
          ジャンルからアルバムを探せます。各ジャンルは既存データのタグから自動でマッチングしています。
        </p>
      </header>

      <section className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {summaries.map(({ genre, count, cover }) => (
          <Link
            key={genre.slug}
            href={`/genres/${genre.slug}`}
            className="card-interactive group flex flex-col overflow-hidden"
          >
            {cover ? (
              <AlbumCover
                imageUrl={coverSrc(cover)}
                fallbackColor={cover.coverColor}
                title={genre.name}
                size="card"
              />
            ) : (
              <div className="aspect-square w-full rounded-md bg-zinc-800" aria-hidden />
            )}
            <div className="flex flex-1 flex-col px-3 py-3">
              <h2 className="text-sm font-semibold leading-snug text-neutral-100 transition group-hover:text-white">
                {genre.name}
              </h2>
              <p className="text-xs text-neutral-500">{genre.nameEn}</p>
              <p className="mt-auto pt-2 text-xs text-neutral-500">
                {count.toLocaleString("ja-JP")} 枚
              </p>
            </div>
          </Link>
        ))}
      </section>
    </div>
  );
}
