# P1: アルバムリスト機能

## 前提(共通)
otonofu: Next.js 16 App Router / TypeScript / Supabase (RLS必須)。データ層 `lib/data/`、Server Actions `app/**/actions.ts`、migrations追加は新規ファイル。UIは日本語・zinc系ダークテーマ。**実装前に `node_modules/next/dist/docs/` を確認。**
※ 01-fix-lists-page.md(プレースホルダー修正)適用後に着手。

## 背景
RYMのコア機能「ユーザー作成リスト」(例: 「90年代邦楽ロック名盤50選」)。ナビ導線はあるが中身が空。

## スキーマ(新規migration: `add_user_lists.sql`)
```sql
create table public.user_lists (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references auth.users (id) on delete cascade,
  title text not null check (char_length(trim(title)) between 1 and 100),
  description text check (char_length(description) <= 2000),
  is_public boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.user_list_items (
  id uuid primary key default gen_random_uuid(),
  list_id uuid not null references public.user_lists (id) on delete cascade,
  album_id text not null references public.albums (id) on delete cascade,
  position integer not null,
  note text check (char_length(note) <= 500),   -- 各アルバムへの一言
  unique (list_id, album_id)
);
-- RLS: publicリストは全員select、作成/編集/削除は本人のみ
```
※ `albums.id` の型は `supabase/schema.sql` で要確認(text想定)。

## UI
1. `/lists`: 公開リスト一覧(新着順)。カードにタイトル・作者・アルバム数・カバー画像を数枚コラージュ表示(既存 `AlbumCard` のcover取得ロジックを流用)
2. `/lists/new`: 作成フォーム(要ログイン)。アルバム検索して追加 → 既存の検索API `app/api/search/route.ts` を再利用。並び替え(position上下ボタンで可、drag&dropは不要)
3. `/lists/[id]`: リスト詳細。番号付きでアルバム表示、各項目にnote、アルバム詳細へリンク。作者本人には編集・削除ボタン
4. アルバム詳細ページ(`app/albums/[id]/page.tsx`)に「リストに追加」ボタン(自分のリスト選択ドロップダウン)
5. `/users/[id]`(03実装済みなら)にそのユーザーのリスト一覧を追加

## 実装配置
- `lib/data/lists.ts`(取得系)、`app/lists/actions.ts`(作成・更新・削除・項目追加)
- 型を `lib/types.ts` に追加: `UserList`, `UserListItem`

## 受け入れ条件
- 作成→アルバム追加→並び替え→公開→他ユーザーが閲覧、の一連が動く
- 非公開リストは本人以外に見えない(RLS検証)
- `npm run build` 成功
