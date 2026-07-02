# P2: 日本語検索の改善

## 前提(共通)
otonofu: Next.js 16 App Router / TypeScript / Supabase (Postgres)。検索実装は `lib/data/search.ts` と `lib/search/normalize.ts`。migrationsは新規ファイル追加。**実装前に `node_modules/next/dist/docs/` を確認。**

## 背景
現状は `ilike '%query%'` の部分一致のみ(`lib/data/search.ts` 140, 190, 244, 344行目付近)。問題:
- ひらがな⇔カタカナ、全角⇔半角の表記ゆれに弱い(normalize.tsの現状カバー範囲をまず確認)
- 「はっぴいえんど」を「ハッピーエンド」で検索できない類の取りこぼし
- 中間一致ilikeはインデックスが効かずデータ増で遅くなる

## 指示
1. **正規化列+pg_trgm方式**(日本語はFTSのtokenizer問題があるためtrigramが現実的):
   - migration `add_search_normalization.sql`:
     - `create extension if not exists pg_trgm;`
     - `artists` に `search_text text`、`albums` に `search_text text` を追加(name/nameEn/title + カナ正規化済み文字列を連結して格納)
     - `create index ... using gin (search_text gin_trgm_ops);`
     - トリガーで insert/update 時に自動更新(正規化はSQL関数で: 全角→半角、カタカナ→ひらがな変換は `translate()` で実装)
2. `lib/search/normalize.ts` にTS側の同等正規化を実装(既存関数を拡張): NFKC正規化、カタカナ→ひらがな、英字小文字化、長音・中黒・スペース除去
3. `lib/data/search.ts` を修正: 正規化したクエリで `search_text` を `ilike` + trigram類似度(`similarity()`)順に並べる。スレッド・レビュー本文検索は現状のilikeのまま可
4. 既存データのbackfill SQLをmigrationに含める
5. サジェスト(`app/api/search/route.ts`)も同じ正規化を通す

## 受け入れ条件
- 「ゆらゆらていこく」(ひらがな)で「ゆらゆら帝国」、カナ表記ゆれでもアーティストがヒットする
- 英語名(nameEn)でも日本語名でも同一アーティストが見つかる
- 検索結果の並びが類似度順になる
- `npm run build` 成功
