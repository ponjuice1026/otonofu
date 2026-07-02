# P2: SEO基盤(sitemap / robots / RSS / OGP / 構造化データ)

## 前提(共通)
otonofu: Next.js 16 App Router / TypeScript。サイト設定は `lib/site.ts`。**Next.js 16のMetadata/sitemap規約は変わっている可能性があるため、必ず `node_modules/next/dist/docs/` の該当ガイドを先に読むこと。**

## 背景
アルバム・アーティスト・レビュー・スレッドという検索需要のあるコンテンツを持つのに、sitemap/robots/RSS/構造化データが一切ない。「アルバム名 レビュー」等での検索流入が本サイトの主要成長経路になるはず。

## 指示
1. `app/robots.ts`: 全体allow、`/admin` `/profile` `/api` をdisallow、sitemap参照
2. `app/sitemap.ts`: 静的ページ+アルバム・アーティスト・スレッド(公開分)の動的URL。件数が多い場合はsitemapのindex分割規約に従う
3. OGPメタデータの充実:
   - `app/albums/[id]/page.tsx`: `generateMetadata` でタイトル「{アルバム名} - {アーティスト名} のレビュー・評価 | otonofu」、description に平均評価とレビュー数、og:image にカバー画像
   - `app/artists/[id]/page.tsx`、`app/threads/[id]/page.tsx` も同様(現状の実装有無を確認し、不足分を追加)
4. 構造化データ(JSON-LD): アルバムページに `MusicAlbum` + `AggregateRating`、アーティストページに `MusicGroup` を `<script type="application/ld+json">` で埋め込む。評価は0-10スケールなので `bestRating: 10` を明示
5. `app/feed.xml/route.ts`: 新着レビュー+新着スレッドのRSS 2.0フィード(最新30件)
6. サイトのベースURLは環境変数(`.env.local.example` に追記)から取得し `lib/site.ts` に集約

## 受け入れ条件
- `/robots.txt` `/sitemap.xml` `/feed.xml` が正しく返る
- アルバムページのOGPがSNSカードプレビューで機能する形式になっている
- JSON-LDがGoogleリッチリザルトテストの必須プロパティを満たす
- `npm run build` 成功
