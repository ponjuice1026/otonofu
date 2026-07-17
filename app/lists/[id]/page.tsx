import Link from "next/link";
import { notFound } from "next/navigation";
import { getUser } from "@/lib/auth/session";
import { getListById } from "@/lib/data/lists";
import { AlbumCover } from "@/components/spotify/AlbumCover";
import { AlbumSearchAdd } from "@/components/list/AlbumSearchAdd";
import { ListItemControls } from "@/components/list/ListItemControls";
import { ListOwnerActions } from "@/components/list/ListOwnerActions";
import { ShareButton } from "@/components/ui/ShareButton";
import { UserLink } from "@/components/user/UserLink";
import { pageTitle, siteUrl } from "@/lib/site";
import type { UserListItem } from "@/lib/types";

type PageProps = {
  params: Promise<{ id: string }>;
};

export const dynamic = "force-dynamic";

function itemCoverSrc(item: UserListItem): string | undefined {
  if (item.coverUrl) return item.coverUrl;
  if (item.spotifyId) return `/api/covers/album/${item.spotifyId}`;
  return undefined;
}

export async function generateMetadata({ params }: PageProps) {
  const { id } = await params;
  const list = await getListById(id);
  if (!list) {
    return { title: pageTitle("リスト") };
  }
  const description = list.description?.trim()
    ? list.description.trim().slice(0, 120)
    : `${list.authorName} が選ぶ ${list.itemCount} 枚のアルバムリスト。`;
  return {
    title: pageTitle(list.title),
    description,
    alternates: { canonical: siteUrl(`/lists/${list.id}`) },
    openGraph: {
      title: pageTitle(list.title),
      description,
      url: siteUrl(`/lists/${list.id}`),
    },
  };
}

export default async function ListDetailPage({ params }: PageProps) {
  const { id } = await params;
  const [list, user] = await Promise.all([getListById(id), getUser()]);

  if (!list) {
    notFound();
  }

  const isOwner = Boolean(user && user.id === list.authorId);

  return (
    <div className="page-shell mx-auto max-w-3xl">
      <Link
        href="/lists"
        className="link-accent mb-6 inline-block text-sm hover:underline"
      >
        ← リスト一覧
      </Link>

      <header className="page-header">
        <div className="flex items-center gap-2">
          <h1 className="page-title">{list.title}</h1>
          {!list.isPublic && (
            <span className="badge shrink-0">非公開</span>
          )}
        </div>
        <p className="page-desc">
          <UserLink
            userId={list.authorId}
            name={list.authorName}
            className="text-neutral-400 hover:underline"
          />
          {" · "}
          {list.itemCount.toLocaleString("ja-JP")} 枚
        </p>
        {list.description && (
          <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-neutral-300">
            {list.description}
          </p>
        )}
        <div className="mt-3">
          <ShareButton url={`/lists/${list.id}`} title={list.title} />
        </div>
      </header>

      {isOwner && (
        <ListOwnerActions
          listId={list.id}
          initial={{
            title: list.title,
            description: list.description,
            isPublic: list.isPublic,
          }}
        />
      )}

      {isOwner && (
        <div className="mb-8">
          <AlbumSearchAdd listId={list.id} />
        </div>
      )}

      {list.items.length > 0 ? (
        <ol className="flex flex-col gap-3">
          {list.items.map((item, index) => (
            <li
              key={item.id}
              className="surface-panel flex items-start gap-4 px-4 py-4"
            >
              <span className="mt-1 w-6 shrink-0 text-right text-sm font-semibold text-neutral-500">
                {index + 1}
              </span>
              <Link
                href={`/albums/${item.albumId}`}
                className="w-16 shrink-0"
                aria-label={item.albumTitle}
              >
                <AlbumCover
                  imageUrl={itemCoverSrc(item)}
                  fallbackColor={item.coverColor}
                  title={item.albumTitle}
                  size="card"
                />
              </Link>
              <div className="min-w-0 flex-1">
                <Link
                  href={`/albums/${item.albumId}`}
                  className="font-semibold text-neutral-100 hover:underline"
                >
                  {item.albumTitle}
                </Link>
                <p className="mt-0.5 text-sm text-neutral-500">
                  {item.artistName}
                  {item.year ? ` · ${item.year}` : ""}
                </p>
                {item.note && (
                  <p className="mt-2 whitespace-pre-wrap text-sm text-neutral-300">
                    {item.note}
                  </p>
                )}
              </div>
              {isOwner && (
                <ListItemControls
                  listId={list.id}
                  itemId={item.id}
                  isFirst={index === 0}
                  isLast={index === list.items.length - 1}
                />
              )}
            </li>
          ))}
        </ol>
      ) : (
        <p className="text-sm text-neutral-500">
          {isOwner
            ? "上のフォームからアルバムを追加してリストを作りましょう。"
            : "このリストにはまだアルバムがありません。"}
        </p>
      )}
    </div>
  );
}
