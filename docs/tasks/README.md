# otonofu 改善タスク指示書

otonofu = Rate Your Music × 5ちゃんねる型の日本向け音楽議論サイト。
本ディレクトリの各ファイルは、AIモデル(または開発者)にそのまま渡せる粒度の実装指示書。

## 優先度と実施順

| 優先度 | ファイル | 内容 | 理由 |
|---|---|---|---|
| **P0** | 01-fix-lists-page.md | リストページの壊れたJSX修正 | ビルドエラーの可能性 |
| **P1** | 02-notifications.md | 通知機能 | 返信に気づけない=議論が続かない致命的欠陥 |
| **P1** | 03-public-user-pages.md | 公開ユーザーページ | レビュアーの人格が見えないとRYM文化が育たない |
| **P1** | 04-lists-feature.md | アルバムリスト機能 | RYMのコア機能。ナビに載っているのに空 |
| **P2** | 05-genre-pages.md | ジャンル別ブラウジング | RYMの中核体験。現状ジャンルは文字列のみ |
| **P2** | 06-search-japanese.md | 日本語検索改善 | ilike部分一致のみ。カナ/表記ゆれ非対応 |
| **P2** | 07-seo.md | sitemap/robots/RSS/OGP | コンテンツサイトなのに検索流入の土台がない |
| **P3** | 08-follow-system.md | フォロー機能 | 03完了後。ソーシャルグラフ |
| **P3** | 09-anti-spam.md | レート制限・スパム対策 | 匿名投稿可のためスケール前に必須 |
| **P3** | 10-testing.md | テスト基盤 | 現状テストゼロ |
| **P3** | 11-user-contribution.md | ユーザーによるDB補完 | Spotify未収録作品への対応 |

依存関係: 08は03の後。それ以外は独立して並行実施可能。

## 共通前提(全タスク共通)

- スタック: Next.js 16 (App Router) / React 19 / TypeScript / Tailwind CSS 4 / Supabase (Postgres + Auth + RLS)
- **Next.js 16は破壊的変更あり。コードを書く前に `node_modules/next/dist/docs/` の該当ガイドを必ず読むこと**(AGENTS.md指示)
- データアクセスは `lib/data/*.ts` に集約。Server Actions は `app/**/actions.ts`
- 型定義は `lib/types.ts`。DBのsnake_case → アプリのcamelCase変換は `lib/data/mappers.ts`
- DBスキーマ変更は `supabase/migrations/` に新規SQLファイルを追加(既存ファイルは変更しない)。RLS必須
- 既存の慣習: `reviews.id` は text型、新しめのテーブルは uuid。匿名ユーザーは `anonymous_name`(1〜24字)+ `voter_key` で識別
- UIは全て日本語。ダークテーマ(zinc系)。既存コンポーネントのスタイルに合わせる
- ページタイトルは `pageTitle()` (`lib/site.ts`) を使用
- 完了条件: `npm run build` が通ること。lint エラーなし
