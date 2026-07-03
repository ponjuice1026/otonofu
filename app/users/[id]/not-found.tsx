import Link from "next/link";

export default function UserNotFound() {
  return (
    <div className="page-shell flex min-h-[60vh] flex-col items-center justify-center text-center">
      <p className="home-hero__eyebrow">404</p>
      <h1 className="page-title mt-2">ユーザーが見つかりません</h1>
      <p className="page-desc mx-auto">
        このユーザーは存在しないか、削除された可能性があります。
      </p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <Link href="/" className="btn-primary">
          ホームへ戻る
        </Link>
      </div>
    </div>
  );
}
