import Link from "next/link";

export default function NotFound() {
  return (
    <div className="page-shell flex min-h-[60vh] flex-col items-center justify-center text-center">
      <p className="home-hero__eyebrow">404</p>
      <h1 className="page-title mt-2">ページが見つかりませんでした</h1>
      <p className="page-desc mx-auto">
        お探しのページは削除されたか、URLが間違っている可能性があります。
      </p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <Link href="/" className="btn-primary">
          ホームへ戻る
        </Link>
        <Link href="/threads" className="btn-secondary">
          セッション一覧を見る
        </Link>
      </div>
    </div>
  );
}
