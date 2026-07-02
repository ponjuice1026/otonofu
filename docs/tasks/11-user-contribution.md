# P3: ユーザーによるデータベース補完(修正依頼・追加リクエスト)

## 前提(共通)
otonofu: Next.js 16 App Router / TypeScript / Supabase (RLS必須)。データ投入は現状Spotify同期のみ(`scripts/sync-spotify.ts`、`lib/spotify/`)。管理画面は `app/admin/`。**実装前に `node_modules/next/dist/docs/` を確認。**

## 背景
RYMの強みはユーザー参加型DB。現状はSpotify収録作品しか扱えず、廃盤・自主制作盤・Spotify未配信の名盤(日本の旧譜に多い)が空白になる。ただし無審査投稿は品質崩壊するため、**申請→管理者承認制**にする。

## スキーマ(新規migration: `add_contribution_requests.sql`)
```sql
create table public.contribution_requests (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('add_artist', 'add_album', 'fix_data')),
  target_artist_id text,      -- fix時。artists.id の型はschema.sqlで要確認
  target_album_id text,
  payload jsonb not null,     -- 申請内容(名前、年、トラックリスト、修正内容説明など)
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  admin_note text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);
-- RLS: 本人は自分の申請をselect/insert、管理者は全件select/update
```

## 指示
1. 申請フォーム:
   - アーティスト/アルバムページに「情報の修正を依頼」リンク → `/contribute?type=fix&album=...`
   - 検索結果ゼロ時に「見つからない作品の追加をリクエスト」導線(`app/search/page.tsx`)
   - フォームは kind ごとに項目を変える(追加: 名前・読み・年・レーベル・トラックリスト自由記述 / 修正: 対象と修正内容)
2. 管理画面(`app/admin/page.tsx`)に申請一覧タブを追加。承認/却下+メモ。承認時の実データ反映は当面**手動**(管理者がSQLまたは既存scriptsで対応)とし、申請のステータス管理までをスコープとする
3. 申請者には状態変化を通知(02実装済みなら type 'contribution' を追加。未実装なら申請一覧を `/profile` に表示)
4. レート制限: 申請 5/日(09実装済みならその仕組みを使用)
5. 実装配置: `lib/data/contributions.ts`、`app/contribute/actions.ts`

## 受け入れ条件
- 申請→管理画面に表示→承認/却下→申請者が結果を確認、の一連が動く
- 一般ユーザーは他人の申請を見られない(RLS検証)
- `npm run build` 成功
