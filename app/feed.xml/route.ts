import { getRecentReviews } from "@/lib/data/reviews";
import { getDiscussionThreadsPage } from "@/lib/data/threads";
import { SITE_DESCRIPTION, SITE_NAME, siteUrl } from "@/lib/site";

export const revalidate = 3600;

const FEED_ITEM_LIMIT = 30;

type FeedItem = {
  title: string;
  link: string;
  description: string;
  pubDate: string;
  guid: string;
};

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function truncate(value: string, max = 200): string {
  const trimmed = value.trim();
  return trimmed.length > max ? `${trimmed.slice(0, max)}…` : trimmed;
}

export async function GET() {
  // 新着レビュー・新着スレッドを多めに取得し、日付でマージして最新 30 件に絞る。
  const [reviews, threads] = await Promise.all([
    getRecentReviews(FEED_ITEM_LIMIT),
    getDiscussionThreadsPage(1, FEED_ITEM_LIMIT, "newest"),
  ]);

  const reviewItems: FeedItem[] = reviews.map((review) => ({
    title: `${review.username}さんによる「${review.albumTitle}」のレビュー`,
    link: siteUrl(`/albums/${review.albumId}#review-${review.id}`),
    description: truncate(review.body || `${review.albumTitle}のレビュー`),
    pubDate: new Date(review.createdAt).toUTCString(),
    guid: `review-${review.id}`,
  }));

  const threadItems: FeedItem[] = threads.map((thread) => ({
    title: thread.title,
    link: siteUrl(`/threads/${thread.id}`),
    description: truncate(
      thread.body || `${thread.title}についてのセッション`,
    ),
    pubDate: new Date(thread.createdAt).toUTCString(),
    guid: `thread-${thread.id}`,
  }));

  const items = [...reviewItems, ...threadItems]
    .sort(
      (a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime(),
    )
    .slice(0, FEED_ITEM_LIMIT);

  const itemsXml = items
    .map(
      (item) => `    <item>
      <title>${escapeXml(item.title)}</title>
      <link>${escapeXml(item.link)}</link>
      <guid isPermaLink="false">${escapeXml(item.guid)}</guid>
      <pubDate>${item.pubDate}</pubDate>
      <description>${escapeXml(item.description)}</description>
    </item>`,
    )
    .join("\n");

  const lastBuildDate = items[0]?.pubDate ?? new Date().toUTCString();

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(SITE_NAME)}</title>
    <link>${escapeXml(siteUrl("/"))}</link>
    <description>${escapeXml(SITE_DESCRIPTION)}</description>
    <language>ja</language>
    <lastBuildDate>${lastBuildDate}</lastBuildDate>
    <atom:link href="${escapeXml(siteUrl("/feed.xml"))}" rel="self" type="application/rss+xml" />
${itemsXml}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
