# オトノフ

音楽の評価・レビュー・共有コミュニティ（開発中）

**リポジトリ:** https://github.com/ryoyuasa2007-bot/-otonofu

## 技術スタック

- [Next.js](https://nextjs.org)（App Router）
- TypeScript
- Tailwind CSS
- 予定: Vercel（ホスティング）、Supabase（DB・認証）

## ローカルで起動

```bash
npm install
npm run dev
```

ブラウザで [http://localhost:3000](http://localhost:3000) を開く。

## 主なページ

| パス | 説明 |
|------|------|
| `/` | トップ |
| `/albums` | アルバム一覧 |
| `/albums/[id]` | アルバム詳細 |
| `/artists` | アーティスト一覧 |
| `/artists/[id]` | アーティスト詳細（経歴・リリース・Spotify画像） |
| `/charts` | チャート |
| `/lists` | リスト |
| `/login` | ログイン（UIのみ） |

## Supabase のセットアップ

1. [supabase.com](https://supabase.com) でプロジェクトを作成（無料プラン可）
2. **Project Settings → API** から URL と `anon` key をコピー
3. プロジェクトルートに `.env.local` を作成（`.env.local.example` を参照）

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
```

4. Supabase Dashboard → **SQL Editor** で `supabase/schema.sql` を実行
5. `npm run dev` を再起動 — 画面上部に「Supabase 接続中」と表示されれば成功

キー未設定時はデータが表示されません。Spotify 同期でアーティストを投入する手順は下記を参照してください。

## ログイン（Supabase Auth）

1. Supabase Dashboard → **Authentication** → **URL Configuration**
   - **Site URL:** `http://localhost:3000`（本番は Vercel の URL）
   - **Redirect URLs:** `http://localhost:3000/auth/callback`
2. **Authentication** → **Providers** で **Email** が有効か確認
3. `/login` で新規登録またはログイン
4. メール確認を有効にしている場合は、届いたリンクをクリック後にログイン

`.env.local` に `NEXT_PUBLIC_SITE_URL=http://localhost:3000` を追加してください。

## Spotify API

Spotify の情報（ジャケット・トラックリスト・フォロワー数など）を、**既存のアーティスト / アルバムページ**に自動表示します。専用タブはありません。

1. [Spotify Developer Dashboard](https://developer.spotify.com/dashboard) でアプリを作成
2. `.env.local` に追加:

```env
SPOTIFY_CLIENT_ID=your_client_id
SPOTIFY_CLIENT_SECRET=your_client_secret
```

3. 既存 Supabase DB には `supabase/migrations/add_spotify_ids.sql` を SQL Editor で実行
4. `/artists/fishmans` や `/albums/2` を開いてジャケット・曲リストを確認

`spotify_id` が未設定のアーティスト / アルバムは、名前から Spotify を検索して自動マッチします。

### Spotify → DB 同期（アーティスト一括追加）

**方法 A（推奨）:** service role key を使って直接同期

1. Supabase Dashboard → **Settings → API** → `service_role` key をコピー
2. `.env.local` に `SUPABASE_SERVICE_ROLE_KEY=...` を追加
3. 実行:

```bash
npm run sync:spotify
```

**方法 B:** SQL ファイルを生成して Supabase で実行（service role 不要）

```bash
npm run sync:spotify:sql
```

生成された `supabase/migrations/sync_spotify_data.sql` の内容を Supabase Dashboard → **SQL Editor** に貼り付けて実行してください。

70 組前後の日本語アーティストを Spotify から取得し、Supabase の `artists` / `albums` を更新します。既存の Fishmans などは ID を維持したまま上書きされます。評価（`avg_rating` / `rating_count`）は同期時に 0 で上書きされます。

### 継続的にカタログを増やす（キュー方式）

数千組規模を想定し、**Supabase の同期キュー**に登録 → **毎日 N 組ずつ** Spotify から取り込みます。

| 種類 | DB に保存 | 増やし方 |
|------|-----------|----------|
| **アーティスト** | ✅ | キューに登録 → 日次バッチ同期 |
| **アルバム / EP** | ✅ | 同期済みアーティストを `--requeue-done` で再キュー |
| **曲（トラック）** | ❌ | アルバム詳細ページ表示時に Spotify から取得 |

**初回セットアップ（1回だけ）**

Supabase SQL Editor で `supabase/migrations/add_artist_sync_queue.sql` を実行してください。

**アーティストを追加する**

1. **少数（メジャー）:** `data/spotify-seeds.txt` に1行追加
2. **大量（インディーズ含む）:** CSV を用意（`data/artists-import.example.csv` 参照）
   ```csv
   アーティスト名,SpotifyArtistID,priority
   バンド名,0123456789abcdef0123456789abcdef,10
   ```
   - `SpotifyArtistID` は任意だが **インディーズは ID 指定推奨**（名前検索はずれやすい）
   - `priority` が大きいほど先に同期
3. キューに登録:
   ```bash
   npm run enqueue:artists
   npm run enqueue:artists -- data/my-indie-artists.csv
   ```
4. 同期（手動で試す場合）:
   ```bash
   npm run sync:spotify:queue          # 30 組ずつ
   npm run sync:spotify:queue -- --limit 10
   ```

**自動同期（GitHub Actions）**

毎日 03:00 JST に:

1. `spotify-seeds.txt` をキューへ登録（未登録分のみ）
2. キューから **30 組** を同期

月900組ペースでキューが消化されます。`SPOTIFY_SYNC_BATCH_SIZE` で1回あたりの件数を変更できます。

**手動フル同期（従来方式）**

```bash
npm run sync:spotify        # seeds.txt 全件を直接同期
npm run sync:spotify:batch  # seeds.txt を日次ローテーション
```

**注意**

- 同期中は `npm run dev` を止めると Spotify 429 に当たりにくい
- 1 アーティストあたり最大 50 件程度のアルバム（API 制限）
- 失敗したキューは最大5回まで自動リトライ

**将来やりたいこと（未実装）**

- 曲を DB に保存してオフライン表示
- 管理画面 / プレイリストからの一括キュー登録
- アーティスト一覧のページネーション

### 自動で定期同期する

**方法 1: GitHub Actions（おすすめ・キュー同期）**

リポジトリの **Settings → Secrets and variables → Actions** に以下を登録:

| Secret | 内容 |
|--------|------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase URL |
| `SUPABASE_SERVICE_ROLE_KEY` | service role key |
| `SPOTIFY_CLIENT_ID` | Spotify Client ID |
| `SPOTIFY_CLIENT_SECRET` | Spotify Client Secret |

`.github/workflows/sync-spotify.yml` が **毎日 03:00 JST** にキュー同期を実行します。  
手動実行: GitHub → **Actions** → **Spotify sync** → **Run workflow**

**方法 2: Vercel Cron（デプロイ後・日次バッチ）**

1. Vercel の Environment Variables に追加:
   - `CRON_SECRET` … ランダムな長い文字列
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `SPOTIFY_CLIENT_ID` / `SPOTIFY_CLIENT_SECRET`
   - （任意）`SPOTIFY_SYNC_BATCH_SIZE=30` … 1回あたり同期するアーティスト数
2. `vercel.json` により **毎日 03:00 JST** に `/api/cron/sync-spotify` が呼ばれます
3. キューから `batchSize` 件ずつ同期（未登録アーティストは先に `npm run enqueue:artists`）

### 評価データのリセット

レビューとアルバム評価をすべて 0 に戻す場合、Supabase Dashboard → **SQL Editor** で `supabase/migrations/reset_ratings.sql` を実行してください。

## ライセンス

未定
