# P3: テスト基盤の導入

## 前提(共通)
otonofu: Next.js 16 App Router / TypeScript / Supabase。現状テストは一切ない。ロジックは `lib/` 配下に集約されている。**実装前に `node_modules/next/dist/docs/` のテスト関連ガイドを確認。**

## 方針
E2Eや網羅は狙わない。**壊れると実害が大きい純粋ロジックのユニットテスト**から始める。

## 指示
1. Vitest を devDependencies に追加し、`npm test` スクリプトを設定(Next.js 16 + React 19 との互換設定に注意)
2. 優先してテストを書く対象(いずれも純関数中心でDB不要):
   - `lib/search/normalize.ts` — 表記ゆれ正規化(06実装後は特に重要)
   - `lib/ratings.ts` / `lib/ratings/` — 評価計算・0-10スケール
   - `lib/threads/post-tree.ts` — 返信ツリー構築
   - `lib/threads/validate.ts` — 投稿バリデーション
   - `lib/albums/ranking-filters.ts` — ランキングのパース/絞り込み
   - `lib/data/mappers.ts` — snake_case→camelCase変換(null/undefined境界)
3. 各対象につき正常系+境界値(空文字、null、極端な値)で計40〜60ケース程度
4. `.github/workflows/` に既存のワークフローがあれば test ステップを追加、なければ lint+test+build を回すCIを新設
5. テストのために既存コードの挙動を変えないこと。テスト困難な箇所はリファクタせず記録に留める

## 受け入れ条件
- `npm test` が全件パス
- CI がプルリクエストで実行される
- `npm run build` に影響なし
