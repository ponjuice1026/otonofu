import Link from "next/link";
import { ContactForm } from "@/components/contact/ContactForm";
import { getUser } from "@/lib/auth/session";
import { pageTitle, siteUrl, SITE_NAME } from "@/lib/site";

export const metadata = {
  title: pageTitle("お問い合わせ"),
  description:
    "オトノフへのお問い合わせフォーム。不具合の報告、機能のご要望、データの訂正依頼などをお送りいただけます。",
  alternates: { canonical: siteUrl("/contact") },
};

export const dynamic = "force-dynamic";

export default async function ContactPage() {
  const user = await getUser();

  return (
    <div className="page-shell mx-auto max-w-2xl">
      <header className="page-header">
        <h1 className="page-title">お問い合わせ</h1>
        <p className="page-desc">
          {SITE_NAME}へのご質問・ご要望・不具合のご報告はこちらから。
          ログインしていなくても送信できます。
        </p>
      </header>

      <div className="legal-prose mb-8">
        <p>
          お送りいただく前に、以下もご確認ください。
        </p>
        <ul>
          <li>
            操作方法については<Link href="/guide">使い方ガイド</Link>
            で解説しています。
          </li>
          <li>
            禁止事項や違反への対応は
            <Link href="/guidelines">ガイドライン</Link>をご覧ください。
          </li>
          <li>
            <strong>個別の投稿の通報</strong>は、各投稿のメニューから行っていただくと
            状況が把握しやすく、対応が早くなります。
          </li>
          <li>
            <strong>作品データの追加・修正</strong>は
            <Link href="/contribute">リクエストフォーム</Link>
            をご利用ください。
          </li>
        </ul>
        <p>
          いただいたお問い合わせには、原則として3営業日以内に返信いたします。
          内容によってはお時間をいただく場合や、
          個別の回答を差し控える場合がありますのでご了承ください。
        </p>
      </div>

      <ContactForm defaultEmail={user?.email ?? undefined} />
    </div>
  );
}
