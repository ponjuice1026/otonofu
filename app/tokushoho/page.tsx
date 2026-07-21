import type { ReactNode } from "react";
import Link from "next/link";
import { pageTitle, siteUrl, SITE_NAME } from "@/lib/site";
import { SITE_POLICY_REVISED_AT } from "@/lib/site-legal";

export const metadata = {
  title: pageTitle("特定商取引法に基づく表記"),
  description:
    "特定商取引法に基づく表記。オトノフの運営者情報と、有料サービスに関する取扱いについて。",
  alternates: { canonical: siteUrl("/tokushoho") },
  robots: { index: false, follow: true },
};

type Row = { term: string; body: ReactNode };

const rows: Row[] = [
  { term: "販売事業者", body: "Shuichi Higashi（個人運営）" },
  { term: "運営統括責任者", body: "Shuichi Higashi" },
  {
    term: "所在地",
    body: (
      <>
        個人運営のため、住所は公開しておりません。
        ご請求があった場合には、遅滞なく開示いたします。
        <Link href="/contact">お問い合わせフォーム</Link>よりご連絡ください。
      </>
    ),
  },
  {
    term: "電話番号",
    body: (
      <>
        個人運営のため、電話番号は公開しておりません。
        ご請求があった場合には、遅滞なく開示いたします。
        お問い合わせは<Link href="/contact">お問い合わせフォーム</Link>
        にて承ります。
      </>
    ),
  },
  {
    term: "お問い合わせ",
    body: (
      <>
        <Link href="/contact">お問い合わせフォーム</Link>
        よりご連絡ください。原則として3営業日以内に返信いたします。
      </>
    ),
  },
  {
    term: "販売価格",
    body: (
      <>
        本サービスは<strong>無料</strong>でご利用いただけます。
        現在、有料で販売している商品・サービスはありません。
      </>
    ),
  },
  {
    term: "商品代金以外の必要料金",
    body: "本サービスの利用にあたって発生するインターネット接続料金・通信料金は、利用者のご負担となります。",
  },
  { term: "支払方法・支払時期", body: "有料サービスの提供はありません。" },
  {
    term: "役務の提供時期",
    body: "アカウント登録の完了後、直ちにご利用いただけます。",
  },
  {
    term: "返品・キャンセルについて",
    body: "有料サービスの提供がないため、返品・返金の対応はありません。アカウントの削除はいつでも行えます。",
  },
  {
    term: "動作環境",
    body: "各種モダンブラウザ（Google Chrome、Safari、Microsoft Edge、Firefox の最新版）の利用を推奨します。JavaScript および Cookie が有効である必要があります。",
  },
];

export default function TokushohoPage() {
  return (
    <div className="page-shell">
      <header className="page-header">
        <h1 className="page-title">特定商取引法に基づく表記</h1>
        <p className="page-desc">
          {SITE_NAME}の運営者情報および取引条件に関する表示です。
        </p>
      </header>

      <div className="legal-prose">
        <dl className="legal-defs">
          {rows.map((row) => (
            <div key={row.term}>
              <dt>{row.term}</dt>
              <dd>{row.body}</dd>
            </div>
          ))}
        </dl>

        <p>
          将来的に有料の機能を提供する場合は、本ページの内容を更新し、
          価格・支払方法・返金条件等を事前に明示します。
        </p>

        <p className="legal-updated">最終更新日: {SITE_POLICY_REVISED_AT}</p>
      </div>
    </div>
  );
}
