import { headers } from "next/headers";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DiscographyRow } from "@/components/album/DiscographyRow";
import { OtherReleasesSection } from "@/components/artist/OtherReleasesSection";
import { splitArtistDiscography } from "@/lib/albums/discography";
import { getAlbumsByArtistId } from "@/lib/data/albums";
import { getArtistById } from "@/lib/data/artists";
import { findGenreForLabel } from "@/lib/genres";
import { artistImageSrc } from "@/lib/covers";
import { pageTitle, siteUrl } from "@/lib/site";

function resolveArtistBackLink(
  referer: string | null,
): { href: string; label: string } {
  if (referer) {
    try {
      const url = new URL(referer);
      if (url.pathname.startsWith("/albums")) {
        return { href: "/albums", label: "← アルバム一覧" };
      }
      if (url.pathname.startsWith("/charts")) {
        return { href: "/charts", label: "← ランキング" };
      }
      if (url.pathname === "/") {
        return { href: "/", label: "← ホーム" };
      }
    } catch {
      // ignore
    }
  }
  return { href: "/", label: "← ホーム" };
}

type PageProps = {
  params: Promise<{ id: string }>;
};

export const revalidate = 3600;
export const dynamicParams = true;

export async function generateMetadata({ params }: PageProps) {
  const { id } = await params;
  const artist = await getArtistById(id);

  if (!artist) {
    return {
      title: pageTitle("アーティスト"),
    };
  }

  const title = pageTitle(`${artist.name} のレビュー・評価`);
  const description = `${artist.name}のアーティストページ。ディスコグラフィとレビュー・評価をチェックできる。オトノフで感想を共有しよう。`;
  const imageSrc = artistImageSrc(artist);

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "profile",
      url: siteUrl(`/artists/${artist.id}`),
      images: imageSrc ? [{ url: imageSrc }] : undefined,
    },
    twitter: {
      card: imageSrc ? "summary_large_image" : "summary",
      title,
      description,
      images: imageSrc ? [imageSrc] : undefined,
    },
    alternates: {
      canonical: siteUrl(`/artists/${artist.id}`),
    },
  };
}

export default async function ArtistDetailPage({ params }: PageProps) {
  const { id } = await params;
  const artist = await getArtistById(id);

  if (!artist) {
    notFound();
  }

  const referer = (await headers()).get("referer");
  const backLink = resolveArtistBackLink(referer);
  const releases = await getAlbumsByArtistId(id);
  const { discography, otherReleases } = splitArtistDiscography(releases);
  const spotifyUrl = artist.spotifyId
    ? `https://open.spotify.com/artist/${artist.spotifyId}`
    : null;
  const imageSrc = artistImageSrc(artist);

  const activeYears = artist.activeTo
    ? `${artist.activeFrom}–${artist.activeTo}`
    : `${artist.activeFrom}–`;

  const absoluteImage = imageSrc
    ? imageSrc.startsWith("http")
      ? imageSrc
      : siteUrl(imageSrc)
    : undefined;

  const artistJsonLd = {
    "@context": "https://schema.org",
    "@type": "MusicGroup",
    name: artist.name,
    ...(artist.nameEn ? { alternateName: artist.nameEn } : {}),
    url: siteUrl(`/artists/${artist.id}`),
    ...(absoluteImage ? { image: absoluteImage } : {}),
    ...(artist.origin ? { foundingLocation: artist.origin } : {}),
    ...(artist.genres.length > 0 ? { genre: artist.genres } : {}),
    ...(artist.bio ? { description: artist.bio } : {}),
  };

  return (
    <div className="page-shell">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(artistJsonLd) }}
      />
      <Link href={backLink.href} className="link-accent mb-6 inline-block text-sm hover:underline">
        {backLink.label}
      </Link>

      <header className="mb-10 border-b border-[var(--border)] pb-8">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
          <div className="relative h-40 w-40 shrink-0 overflow-hidden rounded-full bg-[var(--surface-raised)]">
            {imageSrc ? (
              <Image
                src={imageSrc}
                alt={artist.name}
                fill
                className="object-cover"
                sizes="160px"
                quality={90}
              />
            ) : (
              <div className="h-full w-full bg-[var(--surface-hover)]" aria-hidden />
            )}
          </div>
          <div>
            <h1 className="text-3xl font-bold text-[var(--foreground)]">{artist.name}</h1>
            {artist.nameEn && (
              <p className="mt-1 text-lg text-[var(--muted-foreground)]">{artist.nameEn}</p>
            )}
            <dl className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm text-[var(--muted-foreground)]">
              <div>
                <dt className="inline text-[var(--muted)]">出身 </dt>
                <dd className="inline">{artist.origin}</dd>
              </div>
              <div>
                <dt className="inline text-[var(--muted)]">活動期間 </dt>
                <dd className="inline">{activeYears}</dd>
              </div>
              <div>
                <dt className="inline text-[var(--muted)]">ジャンル </dt>
                <dd className="inline">
                  {artist.genres.map((g, i) => {
                    const genre = findGenreForLabel(g);
                    return (
                      <span key={`${g}-${i}`}>
                        {i > 0 ? "、" : ""}
                        {genre ? (
                          <Link
                            href={`/genres/${genre.slug}`}
                            className="link-accent hover:underline"
                          >
                            {g}
                          </Link>
                        ) : (
                          g
                        )}
                      </span>
                    );
                  })}
                </dd>
              </div>
            </dl>
            {spotifyUrl && (
              <a
                href={spotifyUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="link-accent mt-3 inline-block text-sm hover:underline"
              >
                Spotify で開く →
              </a>
            )}
            <div className="mt-3">
              <Link
                href={`/contribute?type=fix&artist=${artist.id}`}
                className="inline-block text-xs text-[var(--muted)] hover:text-amber-300 hover:underline"
              >
                このアーティストの情報の修正を依頼 →
              </Link>
            </div>
          </div>
        </div>
      </header>

      {releases.length === 0 ? (
        <p className="text-sm text-[var(--muted)]">リリース情報はありません。</p>
      ) : (
        <>
          <section className="mb-12">
            <h2 className="mb-4 text-lg font-semibold text-[var(--foreground)]">
              ディスコグラフィ
              <span className="ml-2 text-sm font-normal text-[var(--muted)]">
                {discography.length} 件
              </span>
            </h2>
            {discography.length > 0 ? (
              <div className="flex flex-col gap-2">
                {discography.map((album) => (
                  <DiscographyRow key={album.id} album={album} fromArtist />
                ))}
              </div>
            ) : (
              <p className="text-sm text-[var(--muted)]">アルバムは登録されていません。</p>
            )}
          </section>

          <OtherReleasesSection releases={otherReleases} />
        </>
      )}
    </div>
  );
}
