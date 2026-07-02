# P1: 通知機能

## 前提(共通)
otonofu: Next.js 16 App Router / TypeScript / Supabase (RLS必須)。データ層は `lib/data/`、Server Actionsは `app/**/actions.ts`、型は `lib/types.ts`。migrationsは `supabase/migrations/` に新規ファイル追加。UIは日本語・zinc系ダークテーマ。**実装前に `node_modules/next/dist/docs/` を確認。**

## 背景
掲示板型サイトなのに、自分のスレッドへの返信・レビューへのコメント・投稿へのリアクションに気づく手段がない。議論の継続性に直結する最重要機能。

## スキーマ(新規migration: `add_notifications.sql`)
```sql
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  type text not null check (type in ('thread_reply', 'post_reply', 'review_comment', 'comment_reply', 'reaction')),
  actor_name text not null,          -- 表示名(匿名対応のためID参照でなく名前を保存)
  thread_id uuid,                    -- 遷移先解決用
  review_id text,                    -- reviews.id は text型なので注意
  post_id uuid,
  comment_id uuid,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index on public.notifications (user_id, created_at desc);
-- RLS: 本人のみ select / update(read_at)可。insertはservice role or security definer関数経由
```

## 通知の発生箇所(既存Server Actionに追記)
- `app/threads/actions.ts`: スレッドへの投稿時→スレ主(`author_id`)へ、返信時→親投稿の投稿者へ(`parent_post_id` 経由。匿名投稿者=author_id null はスキップ)
- レビューコメント作成時(`review_comments` 挿入箇所を検索して特定)→レビュー投稿者へ
- `app/reactions/actions.ts`: goodリアクション時→対象投稿者へ(badは通知しない)
- 自分自身への通知は作らない

## UI
1. ヘッダーにベルアイコン+未読バッジ(`components/layout/` の既存ヘッダーに追加。ログイン時のみ)
2. `/notifications` ページ: 新着順一覧、クリックで該当スレッド/レビューへ遷移し既読化
3. 「すべて既読にする」ボタン
4. データ取得は `lib/data/notifications.ts` を新設、既存の `lib/data/threads.ts` の書き方に合わせる

## 受け入れ条件
- 返信・コメント・goodで通知が作られ、未読数がヘッダーに出る
- 他人の通知は読めない(RLS検証)
- 匿名(ログインなし)投稿者への通知は発生させずエラーにもならない
- `npm run build` 成功
