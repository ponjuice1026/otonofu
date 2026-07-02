# P2: ジャンル別ブラウジング

## 前提(共通)
otonofu: Next.js 16 App Router / TypeScript / Supabase。データ層 `lib/data/`。UIは日本語・zinc系ダークテーマ。**実装前に `node_modules/next/dist/docs/` を確認。**

## 背景
RYMの中核体験は「ジャンルからの発見」。現状 `albums.genre` は単一文字列、`artists.genres` はSpotify由来の文字列配列で、ジャンルページが存在しない。ランキングの絞り込みも文字列連結(`lib/albums/ranking-filters.ts` の `genreBlob`)による曖昧マッチのみ。

## 方針
本格的なジャンル階層DB(RYM式)は過剰。**正規化した固定タクソノミー+マッピング**で始める。

## 指示
1. `lib/genres.ts` を新設: 日本向け主要ジャンルの固定リスト(30〜50個)を定義
   - 例: J-Pop, J-Rock, シティポップ, 歌謡曲, アイドル, V系, アニソン, HIP HOP, R&B, エレクトロニック, テクノ, ハウス, アンビエント, ジャズ, フュージョン, ポストロック, シューゲイザー, パンク, ハードコア, メタル, フォーク, SSW, ファンク, ソウル, クラシック, 実験音楽, ノイズ, レゲエ, ブルース, カントリー…
   - 各ジャンル: `{ slug, name, nameEn, aliases: string[] }`。aliasesにSpotifyジャンル名(例: "j-pop", "city pop", "shibuya-kei")を列挙し、既存データからのマッチングに使う
2. `app/genres/page.tsx`: ジャンル一覧(各ジャンルの代表アルバムカバー+アルバム数)
3. `app/genres/[slug]/page.tsx`: ジャンル別アルバム一覧。ソート(評価順/新着順/年代順)。既存の `getRankedAlbums`(`lib/data/albums.ts`)の絞り込みロジックを参考に、aliasesを使って `albums.genre` と `artists.genres` をマッチング
4. アルバム詳細・アーティスト詳細のジャンル表記を `/genres/[slug]` へのリンクにする(マッチするもののみ)
5. ヘッダーナビ(`lib/site-nav.ts`)に「ジャンル」を追加
6. 将来のためのメモをコードコメントに残す: 本格化する場合は `genres` テーブル+ `album_genres` 中間テーブル+ユーザー投票制へ移行

## 受け入れ条件
- ジャンル一覧→ジャンル別アルバム一覧→アルバム詳細の導線が機能する
- マッチしないジャンル文字列があってもエラーにならない(そのまま非リンク表示)
- `npm run build` 成功
