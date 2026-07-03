# 初期シードコンテンツ 投入手順

`data/seed-reviews.json` は、ローンチ初速のための「運営が用意する初期レビュー + 議論の火種」です。
邦楽の名盤15枚(レビュー+5項目評価)、匿名口コミ34件、議論スレ6本が入っています。

## 方針(なぜこの中身か)
- 聖地化ジャンル: **邦楽オルタナ/インディ〜シティポップ**。評論好きが愛し、RateYourMusicの日本語カバーが薄い=差別化が最も効く領域。
- 収録アルバムは同期リスト(`data/spotify-seeds.txt`)に含まれるアーティスト中心。**先にSpotify同期を済ませておけば、対応アルバムが既にDBにある**のでFKが通りやすい。

## いちばん簡単な投入方法（スクリプト）
`scripts/seed-reviews.ts` が、この JSON を **Supabase へ直接・冪等に投入**します（何度実行しても重複しません）。

事前準備:
1. 対象アルバムを Spotify 同期済みにする（`npm run sync:spotify` 等）。
2. 編集部用アカウントを 1 つ作成し、その **auth ユーザー ID(UUID)** を控える
   （Supabase Dashboard → Authentication → Users）。
3. `.env.local` に `NEXT_PUBLIC_SUPABASE_URL` と `SUPABASE_SERVICE_ROLE_KEY` があること。

実行:
```bash
# まずマッチ確認（書き込みなし・どのアルバムに紐づくか一覧表示）
SEED_EDITOR_USER_ID=<uuid> npm run seed:reviews -- --dry

# 問題なければ本投入
SEED_EDITOR_USER_ID=<uuid> npm run seed:reviews

# レビューの表示名を変えたい場合
SEED_EDITOR_USER_ID=<uuid> SEED_EDITOR_NAME=編集部 npm run seed:reviews
```

スクリプトがやること: アルバム照合（タイトル+アーティストのゆるいマッチ）→ `reviews` を upsert →
レビューの議論セッション(`discussion_threads`)を自動生成 → `review_comments`(口コミ)を投入 →
独立した議論スレ(火種)を投入。**未マッチのアルバムは最後に一覧表示**されるので、
Spotify 同期漏れやタイトル表記を直して再実行すればOK（重複しません）。

以下は、スクリプトを使わず手作業で入れる場合の内訳です。

## 投入の順番(重要)
`reviews.album_id` → `albums.id` の外部キーがあるため、**アルバムが先、レビューが後、口コミが最後**。

1. **アルバムを用意** — 各エントリの `spotify_query` でSpotifyを検索し、対象アルバムを同期(`npm run sync:spotify` 等)。同期後の `albums.id`(Spotify ID)を控える。
2. **運営(編集部)アカウントを1つ用意** — レビューは `reviews.user_id` が必要。公式レビュー用のプロフィールを1つ作り、その `user_id` を使う。
3. **レビュー挿入** — `reviews` に以下をマッピング:
   - `user_id` = 編集部アカウント
   - `album_id` = 手順1で解決したID / `album_title` = `album`
   - `rating` = `rating` / `rating_lyrics` `rating_melody` `rating_performance` `rating_atmosphere` `rating_completion` = 各項目
   - `body` = `body`
   - 挿入トリガーで `albums.avg_rating` / `rating_count` は自動再計算されます。
   - `session_opt_out=false` のままにすれば `discussion_threads` に**レビューのセッションが自動生成**されます(`add_review_sessions.sql` のロジック)。
4. **口コミ挿入** — `review_comments` に、対応レビューの `review_id` を付けて `anonymous_name` / `body` を挿入(`author_id` は NULL 可)。
5. **議論スレ挿入(任意)** — `discussion_threads` に、`author_id`=編集部、`title` / `body`、可能なら `album_hint` から解決した `album_id` を付けて挿入。

## 使い方のコツ
- 一度に全部出さず、**ローンチ日に一気に公開**して「人がいる」密度を演出。
- 口コミは「呼び水」。早期の本物ユーザーが来たら、そちらの投稿を主役にしていく。
- スコアは意図的にバラつかせています(全部10点にしない)。信頼感のため、この設計は保ってください。

## 大事な注意(信頼を守るため)
- `body`(レビュー本文)は**運営/編集部名義で堂々と公開できる“本物のレビュー”**として書いています。編集部アカウントである旨が分かる表示だと、より誠実です。
- `review_comments` は議論を始めるためのシードで、**実在の別人になりすます意図はありません**。特定の実在人物の発言を騙るような改変はしないでください。将来的には本物のユーザー投稿へ置き換えていくのが理想です。
- 事実関係(発売年・曲名など)は一般に知られた範囲にとどめています。公開前に念のため確認を。
