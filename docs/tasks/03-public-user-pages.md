# P1: 公開ユーザーページ

## 前提(共通)
otonofu: Next.js 16 App Router / TypeScript / Supabase。データ層 `lib/data/`、型 `lib/types.ts`。UIは日本語・zinc系ダークテーマ。**実装前に `node_modules/next/dist/docs/` を確認。**

## 背景
現在 `/profile` は本人専用(robots noindex)。他ユーザーのレビュー履歴・評価傾向を見る手段がなく、「あのレビュアーが好き」というRYM的な文化が育たない。

## 指示
1. `app/users/[id]/page.tsx` を新設(公開・インデックス可)
   - 表示: アバター、表示名、bio、参加日、統計(レビュー数・平均評価・スレッド数)
   - そのユーザーのレビュー一覧(既存 `ReviewCard` を再利用、`lib/data/reviews.ts` の `getReviewsByUserId` を流用)
   - 作成スレッド一覧(`getDiscussionThreadsByAuthorId` を流用)
   - 参考実装: `app/profile/page.tsx` の構成をほぼ流用できる(編集UI・ログアウトを除く)
2. profilesテーブルの公開列(display_name, bio, avatar_url, created_at)がRLSで全員selectできることを確認。できない場合はmigration追加
3. 既存のレビューカード・スレッド一覧・コメントの投稿者名を `/users/[id]` へのリンクにする(user_idがある場合のみ。匿名投稿はリンクなし)
4. `loading.tsx` / `not-found.tsx` を追加(`app/artists/[id]/` の慣習に合わせる)
5. プライバシー: メールアドレス等の非公開情報を絶対に出さない

## 受け入れ条件
- ログアウト状態でも他ユーザーのページが見られる
- レビュー・スレッドから投稿者名クリックで遷移できる
- 存在しないIDは404
- `npm run build` 成功
