import Link from "next/link";
import { pageTitle } from "@/lib/site";

export const metadata = {
  title: pageTitle("リスト"),
};

export default function ListsPage() {
  return (
    <div className="page-shell">
      <header className="page-header">
        <h1 className="page-title">リスト</h1>
        <p className="page-desc">ユーザーが作ったアルバムリスト</p>
      </header>

      <section>
        <p className="empty-state">
          この機能は現在準備中です。もうしばらくお待ちください。
        </p>
        <div className="mt-6 flex flex-wrap gap-3 text-sm">
          <Link href="/" className="link-accent hover:underline">
            ホームへ戻る
          </Link>
          <Link href="/threads" className="link-accent hover:underline">
            セッションを見る
          </Link>
          <Link href="/albums" className="link-accent hover:underline">
            アルバムを探す
          </Link>
        </div>
      </section>
    </div>
  );
}
