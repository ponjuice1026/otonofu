# P3: フォロー機能(要: 03-public-user-pages 完了)

## 前提(共通)
otonofu: Next.js 16 App Router / TypeScript / Supabase (RLS必須)。データ層 `lib/data/`、Server Actions `app/**/actions.ts`。UIは日本語・zinc系ダークテーマ。**実装前に `node_modules/next/dist/docs/` を確認。**

## 背景
好みの近いレビュアーを追いかけるのがRYM系サイトの定着要因。公開ユーザーページ(03)の次の一手。

## スキーマ(新規migration: `add_follows.sql`)
```sql
create table public.user_follows (
  follower_id uuid not null references auth.users (id) on delete cascade,
  followee_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, followee_id),
  check (follower_id <> followee_id)
);
-- RLS: select は全員可、insert/delete は follower_id = auth.uid() のみ
```

## 指示
1. `/users/[id]` にフォロー/フォロー解除ボタン(要ログイン、自分には非表示)+フォロワー数/フォロー数表示
2. フォロー/フォロワー一覧(`/users/[id]/followers`, `/users/[id]/following`)
3. ホーム(`app/page.tsx`)に「フォロー中のユーザーの新着レビュー」セクションを追加(ログイン時のみ、`lib/threads/home-feed.ts` の既存フィード構成に合わせる)
4. フォローされたら通知(02-notifications 実装済みなら type に 'follow' を追加)
5. 実装配置: `lib/data/follows.ts`、`app/users/actions.ts`

## 受け入れ条件
- フォロー→ホームに対象ユーザーのレビューが出る→解除で消える
- 自分自身をフォローできない(DB制約+UI)
- `npm run build` 成功
