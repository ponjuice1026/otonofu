import Link from "next/link";
import { redirect } from "next/navigation";
import { ContributeForm } from "@/components/contribute/ContributeForm";
import { getUser } from "@/lib/auth/session";
import { getAlbumById } from "@/lib/data/albums";
import { getArtistById } from "@/lib/data/artists";
import { isContributionKind } from "@/lib/contributions/constants";
import { pageTitle } from "@/lib/site";
import type { ContributionKind } from "@/lib/types";

export const metadata = {
  title: pageTitle("データの追加・修正を依頼"),
};

export const dynamic = "force-dynamic";

type ContributePageProps = {
  searchParams: Promise<{
    type?: string;
    album?: string;
    artist?: string;
    q?: string;
  }>;
};

export default async function ContributePage({
  searchParams,
}: ContributePageProps) {
  const user = await getUser();
  if (!user) {
    redirect("/login?redirect=/contribute");
  }

  const { type, album, artist, q } = await searchParams;

  // 修正対象の解決（type=fix かつ album/artist 指定時）
  let target:
    | { artistId?: string; albumId?: string; label: string }
    | undefined;

  if (type === "fix" && album) {
    const a = await getAlbumById(album);
    if (a) {
      target = { albumId: a.id, label: `${a.title}（アルバム）` };
    }
  } else if (type === "fix" && artist) {
    const a = await getArtistById(artist);
    if (a) {
      target = { artistId: a.id, label: `${a.name}（アーティスト）` };
    }
  }

  // 初期の申請種別。修正対象があれば fix_data、
  // 検索ゼロ件からの導線（q 付き）ならアルバム追加を既定にする。
  let initialKind: ContributionKind = "add_album";
  if (target) {
    initialKind = "fix_data";
  } else if (type && isContributionKind(type)) {
    initialKind = type as ContributionKind;
  } else if (type === "add_artist") {
    initialKind = "add_artist";
  }

  return (
    <div className="page-shell mx-auto max-w-2xl">
      <header className="page-header">
        <Link href="/search" className="link-accent mb-3 inline-block text-sm hover:underline">
          ← 検索に戻る
        </Link>
        <h1 className="page-title">
          {target ? "情報の修正を依頼" : "見つからない作品の追加をリクエスト"}
        </h1>
        <p className="page-desc">
          {target
            ? "誤った情報や不足している情報の修正を依頼できます。"
            : "Spotify に未収録の作品（廃盤・自主制作盤・未配信の旧譜など）の追加をリクエストできます。"}
          管理者が確認し、結果は通知でお知らせします。
        </p>
      </header>

      {q && !target && (
        <p className="mb-4 rounded-md border border-zinc-800 bg-zinc-900/50 px-3 py-2 text-sm text-zinc-300">
          検索キーワード:{" "}
          <span className="text-zinc-100">{q}</span>
        </p>
      )}

      <ContributeForm initialKind={initialKind} target={target} />
    </div>
  );
}
