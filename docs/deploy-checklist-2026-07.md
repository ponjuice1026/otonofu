# otonofu デプロイ・migration適用チェックリスト（Phase 0〜6）

2026-07 の改善(Phase 0〜6)を本番に反映するための手順。**上から順に**実行する。
SQL は Supabase Dashboard → SQL Editor に貼って実行。各ファイルは
`supabase/migrations/` にある。すべて再実行安全(`if not exists` / `create or replace` /
`on conflict do nothing`)なので、途中でやり直しても壊れない。

## 前提（すでに適用済みのはず）

以下の基盤migrationが本番DBに適用済みであること。未適用なら先に当てる。

- `add_admin_role.sql`（`current_user_is_admin()` を定義。カテゴリ/BAN/NGワードのRLSが依存）
- `add_discussion_threads.sql` / `add_post_replies.sql` / `add_discussion_polls.sql`
- `add_review_comments.sql` / `add_reactions.sql` / `add_content_reports.sql`
- `add_rate_limits.sql`（`check_rate_limit()` を定義。挿入RPCが依存）
- `add_user_ratings.sql` / `rating_scale_0_10.sql`（reviews.user_id、0〜10スケール）
- `add_notifications.sql` / `add_thread_views.sql`

## SQL 適用順（今回の追加分・この順で実行）

1. **`enforce_insert_rpc.sql`**（Phase1 A-2）
   挿入を security definer RPC 化。旧permissive insertポリシーをdrop。
   ※ 依存: discussion_posts/review_comments/discussion_poll_votes/check_rate_limit
2. **`add_thread_view_dedup.sql`**（Phase1 A-3）
   view_count水増し防止。`increment_thread_views_dedup` 追加、旧関数をrevoke。
3. **`add_post_author_id.sql`**（Phase2）
   discussion_posts に author_id / is_anonymous / thread_local_id 追加 + 自己削除ポリシー。
4. **`update_create_discussion_post_author.sql`**（Phase2）
   `create_discussion_post` を8引数版に更新(author_id等を保存)。※ 3 の後。
5. **`add_moderation_words.sql`**（Phase5）
   banned_words テーブル + 管理者RLS。※ current_user_is_admin に依存。
6. **`add_user_bans.sql`**（Phase5）
   user_bans テーブル + `otonofu_is_banned()`。
7. **`update_moderation_rpc.sql`**（Phase5）
   3つの挿入RPCにBANチェック+NGワード照合を追加(8引数版create_discussion_postを維持)。
   ※ 4・5・6 の後。
8. **`add_ranked_albums_bayesian.sql`**（Phase3）
   ベイズ加重ランキングRPC。※ albums にのみ依存、他と独立。
9. **`add_ranked_albums_by_period.sql`**（Phase3）
   期間別ランキングRPC。※ reviews にのみ依存、他と独立。
10. **`add_thread_categories.sql`**（Phase6）
    discussion_categories テーブル + 8カテゴリseed + discussion_threads.category_id。
    ※ current_user_is_admin と discussion_threads に依存。

## 追加改善分（レビュー時刻精度・スレ凍結・投票緩和）の migration

上記10本の後に、以下を順に適用する（すべて再実行安全）。

> **重要バグ修正**: `update_moderation_rpc.sql`（7番）の create_discussion_post には
> 引数 `parent_post_id` と列 `parent_post_id` の曖昧参照バグがあり、**返信投稿が失敗**する。
> 7番を適用済みの環境では、直後に **`fix_parent_post_id_ambiguous.sql`** を適用して修正すること
> （`#variable_conflict use_variable` プラグマを足すだけ・シグネチャ不変）。
> 12番 `add_thread_lock.sql` も修正済みの版で create_discussion_post を再定義するため、
> 12番まで順に当てるなら最終的に修正版になる（fix単独適用は7番だけ先に試す場合の保険）。

11. **`alter_reviews_created_at_timestamptz.sql`**（レビュー時刻精度）
    reviews.created_at を date→timestamptz に変更 + default now() + index。※ reviews のみに依存、独立。
12. **`add_thread_lock.sql`**（スレ凍結）
    discussion_threads に locked_at/locked_by/lock_reason 追加。create_discussion_post と
    vote_discussion_poll を「凍結チェック込み」で create or replace。lock/unlock RPC 追加。
    ※ 7(update_moderation_rpc.sql)の後に適用すること（最新RPCをベースに更新するため）。
13. **`add_poll_vote_ip_hash.sql`**（投票のcookie依存緩和）
    discussion_poll_votes に ip_hash 追加 + 部分ユニークindex。vote_discussion_poll を
    4引数版(ip_hash対応)に create or replace し、**旧3引数版を drop**。
    ※ 12 の後に適用すること。

新 env は不要（IPハッシュのsaltは既存の THREAD_ID_SALT→VIEW_HASH_SALT→Supabase URL を再利用）。

## 最後に必ず実行（BANの抜け穴を塞ぐ）

`create_discussion_post` を8引数版に更新した際、Postgresの仕様で**旧6引数版が
オーバーロードとして残存**する。旧版にはBANチェックもauthor_idも無く、anonキーで
直接叩けばBANを回避できる。7 まで適用した後に落とす:

```sql
drop function if exists public.create_discussion_post(uuid, text, text, text, uuid, text);
```

実行後、`create_discussion_post` が8引数版だけになっていることを確認:

```sql
select oid::regprocedure from pg_proc where proname = 'create_discussion_post';
-- create_discussion_post(uuid,text,text,text,uuid,text,boolean,text) の1行だけが理想
```

## 環境変数（本番: Vercel → Settings → Environment Variables）

| 変数 | 用途 | 未設定時 |
|---|---|---|
| `NEXT_PUBLIC_SITE_URL` | パスワードリセット等のメールURL生成(Host注入対策/Phase1 A-4) | ヘッダ由来(開発用)。**本番は必須設定** |
| `THREAD_ID_SALT` | 5chスレ内IDのハッシュsalt(Phase2) | VIEW_HASH_SALT→Supabase URL。**本番は専用値推奨** |
| `VIEW_HASH_SALT` | view_count重複排除のviewer_hash(Phase1 A-3) | Supabase URL。専用値推奨 |
| `NEXT_PUBLIC_SUPABASE_URL` / `..._ANON_KEY` | 既存 | — |
| `SUPABASE_SERVICE_ROLE_KEY` / `CRON_SECRET` / `SPOTIFY_*` | 既存 | — |

salt類は**一度決めたら変えない**(変えると以降のスレ内ID・view dedupがずれる)。

## デプロイ順序の注意（重要）

コードとDBに相互依存がある。特に 1(`enforce_insert_rpc.sql`)は旧insertポリシーを
dropするため、**古いアプリ(直接insert)が動いている状態でSQLだけ先に当てると匿名投稿が
RLSで弾かれる**。逆に新アプリだけ先にデプロイするとRPC未定義で投稿が失敗する。

推奨手順:
1. まず**全SQL(1〜10 + drop)をSupabaseに適用**する
2. 直後に**新しいアプリをデプロイ**する（`git push` で Vercel が自動デプロイする構成ならSQL適用を先に済ませておく）
3. 適用〜デプロイの間の短い時間だけ投稿系が不安定になりうるが、プレローンチ段階なら許容範囲

## push について

- ローカルコミットを GitHub に push する行為自体は問題ない(自分のリポジトリ)。
- ただし **Vercel等で自動デプロイが有効な場合、push = 本番デプロイのトリガー**になる。
  その場合は上記「デプロイ順序」に従い、**先にSQLを全部当ててから push** すること。
  さもないと、DBが古いまま新コードが本番に出て投稿・ランキング・カテゴリが壊れる。
- 自動デプロイが無い(手動デプロイ)なら、push は単にコードを送るだけなので先でも後でもよい。

## デプロイ前のローカル確認

```
npm run build      # 型・ビルドが通る
npm test           # 全テスト緑(bayesian / thread-id / postgrest-filter / moderation / posts-pagination 追加分含む)
```

## デプロイ後の動作確認(スモークテスト)

- [ ] 匿名でスレにレス投稿できる / ログインで投稿できる
- [ ] レスに `ID:xxxxxx`(スレ内ID)が表示される
- [ ] 自分のレスに削除ボタンが出て削除できる / 他人のレスには出ない
- [ ] 返信すると相手に通知が届く
- [ ] スレ作成時にカテゴリを選べる / 一覧でカテゴリ絞り込みができる
- [ ] レスが多いスレでページャが出る
- [ ] ランキングで評価1件のアルバムが最上位に来ない
- [ ] 管理者で /admin の NGワード管理・BAN管理が使える
- [ ] NGワード登録後、その語を含む投稿が弾かれる
- [ ] BAN登録した voter_key / user_id で投稿できなくなる
