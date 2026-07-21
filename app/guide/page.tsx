import Link from "next/link";
import { pageTitle, siteUrl } from "@/lib/site";

export const metadata = {
  title: pageTitle("使い方ガイド"),
  description:
    "オトノフの使い方ガイド。アカウント登録からレビュー投稿、セッションの立て方、リスト作成までの基本操作を紹介します。",
  alternates: { canonical: siteUrl("/guide") },
};

export default function GuidePage() {
  return (
    <div className="page-shell">
      <header className="page-header">
        <h1 className="page-title">使い方ガイド</h1>
        <p className="page-desc">
          はじめてでも迷わないように、基本の流れをまとめました。
        </p>
      </header>

      <div className="legal-prose">
        <h2>1. アカウントをつくる</h2>
        <p>
          読むだけならログインは不要です。レビューを書いたり、セッションに参加したり、
          リストを作るにはアカウントが必要になります。
          <Link href="/login">ログインページ</Link>から登録してください。
        </p>
        <p>
          登録後、<Link href="/profile">プロフィール</Link>
          で表示名・自己紹介・アバターを設定できます。
          ユーザー名は他の人があなたを見つけるための ID になります。
        </p>

        <h2>2. 作品をさがす</h2>
        <ul>
          <li>
            <strong>検索</strong> — アルバム名・アーティスト名から
            <Link href="/search">検索</Link>できます。読みがな（ひらがな・カタカナ）でもヒットします。
          </li>
          <li>
            <strong>ランキング</strong> —{" "}
            <Link href="/charts">ランキング</Link>
            では、みんなの評価を集計した上位作品を期間別に見られます。
          </li>
          <li>
            <strong>一覧から</strong> —{" "}
            <Link href="/charts?sort=newest">新着順のランキング</Link>
            で全アルバムをリリース年順に眺めることもできます。
            アーティストのページは、各アルバムの表記から辿れます。
          </li>
        </ul>
        <p>
          目当ての作品が見つからないときは、
          <Link href="/contribute">追加リクエスト</Link>
          を送ってください。配信されていない旧譜・廃盤・自主制作盤なども、
          運営が確認のうえ登録します。
        </p>

        <h2>3. レビューを書く・評価する</h2>
        <p>
          アルバムのページから「レビューを書く」を選ぶと、評価と感想を投稿できます。
          評価は次の4項目で、それぞれ0〜10点でつけます。
        </p>
        <ul>
          <li>
            <strong>歌詞</strong> — 言葉そのものの強さ、世界観、物語性
          </li>
          <li>
            <strong>音楽性</strong> — 演奏・アレンジ・音作りの完成度
          </li>
          <li>
            <strong>雰囲気</strong> — アルバム全体を貫く空気、聴後感
          </li>
          <li>
            <strong>革新性</strong> — 新しさ、その時代における挑戦の度合い
          </li>
        </ul>
        <p>
          すべての項目を埋める必要はありません。点数だけでも、文章だけでも投稿できます。
          曲単位の評価をつけることもできます。
        </p>
        <p>
          投稿したレビューには他のユーザーからリアクションやコメントがつきます。
          自分のレビューはあとから編集・削除できます。
        </p>

        <h2>4. セッションで話す</h2>
        <p>
          「セッション」は、アルバムやテーマを起点にした語り合いのスレッドです。
          <Link href="/threads">セッション一覧</Link>
          から気になるものに参加するか、自分で新しく立ててみてください。
        </p>
        <ul>
          <li>作成時にアルバムやアーティストを紐づけると、作品ページからも見つけてもらえます。</li>
          <li>投票（ポール）を添えると、読むだけの人も気軽に参加できます。</li>
          <li>投稿には返信でき、会話はスレッド状にぶら下がります。</li>
        </ul>

        <h2>5. リストをつくる</h2>
        <p>
          <Link href="/lists">リスト</Link>
          では、テーマに沿ってアルバムを並べた自分だけの選盤を作れます。
          「雨の日に聴く10枚」「入門にすすめたい5枚」など、切り口は自由です。
          公開設定にすると他のユーザーからも見られます。
        </p>

        <h2>6. フォローと通知</h2>
        <p>
          気の合うユーザーをフォローすると、
          <Link href="/following">フォロー中</Link>
          にその人のレビューやセッションが集まります。
          自分の投稿への返信・コメント・リアクションは
          <Link href="/notifications">通知</Link>に届きます。
        </p>

        <h2>7. 困ったときは</h2>
        <ul>
          <li>
            ルールや禁止事項は<Link href="/guidelines">ガイドライン</Link>にまとめています。
          </li>
          <li>
            不適切な投稿を見かけたら、各投稿の通報メニューから運営に知らせてください。
          </li>
          <li>
            それでも解決しない場合は<Link href="/contact">お問い合わせ</Link>からご連絡ください。
          </li>
        </ul>
      </div>
    </div>
  );
}
