import Link from "next/link";
import { notFound } from "next/navigation";
import { AlbumCard } from "@/components/album/AlbumCard";
import {
  GENRE_SORT_OPTIONS,
  getAlbumsForGenre,
  parseGenreSort,
} from "@/lib/data/genres";
import { getGenreBySlug } from "@/lib/genres";
import { getArtistNameMapForIds } from "@/lib/data/artists";
import { pageTitle } from "@/lib/site";

// ジャンル別アルバム一覧は auth 非依存の公開データ（getAlbumsForGenre は
// ユーザー個別表示・cookie を参照しない）。5 分の ISR に置く。
export const revalidate = 300;

type PageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ sort?: string }>;
};

export async function generateMetadata({
  params,
}: Pick<PageProps, "params">) {
  const { slug } = await params;
  const genre = getGenreBySlug(slug);
  if (!genre) {
    return { title: pageTitle("ジャンル") };
  }
  return {
    title: pageTitle(genre.name),
    description: `${genre.name}(${genre.nameEn})のアルバム一覧`,
  };
}

function sortHref(slug: string, sort: string): string {
  return sort === "rating" ? `/genres/${slug}` : `/genres/${slug}?sort=${sort}`;
}

export default async function GenreDetailPage({
  params,
  searchParams,
}: PageProps) {
  const { slug } = await params;
  const { sort: sortParam } = await searchParams;

  if (!getGenreBySlug(slug)) {
    notFound();
  }

  const sort = parseGenreSort(sortParam);
  const result = await getAlbumsForGenre(slug, sort);

  if (!result) {
    notFound();
  }

  const { genre, albums, total } = result;
  const artistNames = await getArtistNameMapForIds(
    albums.map((album) => album.artistId),
  );

  return (
    <div className="page-shell">
      <Link
        href="/genres"
        className="link-accent mb-6 inline-block text-sm hover:underline"
      >
        ← ジャンル一覧
      </Link>

      <header className="page-header">
        <h1 className="page-title">{genre.name}</h1>
        <p className="page-desc">
          {genre.nameEn} · {total.toLocaleString("ja-JP")} 枚
        </p>
      </header>

      <div className="mb-6">
        <p className="mb-2 text-xs font-medium uppercase tracking-wider text-neutral-500">
          並び替え
        </p>
        <div className="tab-group flex-wrap">
          {GENRE_SORT_OPTIONS.map((option) => (
            <Link
              key={option.value}
              href={sortHref(slug, option.value)}
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

      {albums.length > 0 ? (
        <section className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {albums.map((album) => (
            <AlbumCard
              key={album.id}
              album={album}
              artistName={artistNames.get(album.artistId)}
            />
          ))}
        </section>
      ) : (
        <p className="empty-state">
          このジャンルにマッチするアルバムはまだありません。
          <Link href="/genres" className="link-accent ml-2 hover:underline">
            他のジャンルを見る →
          </Link>
        </p>
      )}
    </div>
  );
}
