import type { MetadataRoute } from "next";
import { getAlbums } from "@/lib/data/albums";
import { getArtists } from "@/lib/data/artists";
import { getDiscussionThreadsPage } from "@/lib/data/threads";
import { getPublicLists } from "@/lib/data/lists";
import { GENRES } from "@/lib/genres";
import { siteUrl } from "@/lib/site";

export const revalidate = 3600;

// Google の 1 sitemap あたりの上限は 50,000 URL。
// 現状の総件数は十分下回るため単一 sitemap で扱う。
// 将来 URL が増えた場合は generateSitemaps によるインデックス分割へ移行する。
const MAX_THREAD_PAGES = 50; // published スレッドを最大 500 件まで（THREADS_PAGE_SIZE=10）

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticPaths = [
    "/",
    "/albums",
    "/artists",
    "/charts",
    "/genres",
    "/threads",
    "/lists",
    "/search",
  ];

  const staticEntries: MetadataRoute.Sitemap = staticPaths.map((path) => ({
    url: siteUrl(path),
    lastModified: new Date(),
    changeFrequency: "daily",
    priority: path === "/" ? 1 : 0.7,
  }));

  const genreEntries: MetadataRoute.Sitemap = GENRES.map((genre) => ({
    url: siteUrl(`/genres/${genre.slug}`),
    lastModified: new Date(),
    changeFrequency: "weekly",
    priority: 0.6,
  }));

  const [albums, artists, publicLists] = await Promise.all([
    getAlbums(),
    getArtists(),
    getPublicLists(200),
  ]);

  const albumEntries: MetadataRoute.Sitemap = albums.map((album) => ({
    url: siteUrl(`/albums/${album.id}`),
    lastModified: new Date(),
    changeFrequency: "weekly",
    priority: 0.8,
  }));

  const artistEntries: MetadataRoute.Sitemap = artists.map((artist) => ({
    url: siteUrl(`/artists/${artist.id}`),
    lastModified: new Date(),
    changeFrequency: "weekly",
    priority: 0.6,
  }));

  const listEntries: MetadataRoute.Sitemap = publicLists.map((list) => ({
    url: siteUrl(`/lists/${list.id}`),
    lastModified: new Date(),
    changeFrequency: "weekly",
    priority: 0.5,
  }));

  // 公開スレッドをページングで収集（新着順）。
  const threadEntries: MetadataRoute.Sitemap = [];
  for (let page = 1; page <= MAX_THREAD_PAGES; page += 1) {
    const threads = await getDiscussionThreadsPage(page, 10, "newest");
    if (threads.length === 0) break;
    for (const thread of threads) {
      threadEntries.push({
        url: siteUrl(`/threads/${thread.id}`),
        lastModified: new Date(thread.updatedAt),
        changeFrequency: "daily",
        priority: 0.6,
      });
    }
    if (threads.length < 10) break;
  }

  return [
    ...staticEntries,
    ...genreEntries,
    ...albumEntries,
    ...artistEntries,
    ...listEntries,
    ...threadEntries,
  ];
}
