import Link from "next/link";

export default function AlbumNotFound() {
  return (
    <div className="page-shell flex min-h-[60vh] flex-col items-center justify-center text-center">
      <p className="home-hero__eyebrow">404</p>
      <h1 className="page-title mt-2">アルバムが見つかりません</h1>
      <p className="page-desc mx-auto">
        このアルバムは削除されたか、存在しない可能性があります。
      </p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <Link href="/albums" className="btn-primary">
          アルバム一覧へ戻る
        </Link>
        <Link href="/" className="btn-secondary">
          ホームへ戻る
        </Link>
      </div>
    </div>
  );
}
