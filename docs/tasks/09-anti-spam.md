# P3: レート制限・スパム対策

## 前提(共通)
otonofu: Next.js 16 App Router / TypeScript / Supabase。Server Actions: `app/threads/actions.ts`, `app/reviews/actions.ts`, `app/reactions/actions.ts`, `app/reports/actions.ts`。匿名投稿可(anonymous_name + voter_key)。**実装前に `node_modules/next/dist/docs/` を確認。**

## 背景
匿名投稿を許す5ch型設計なのに、レート制限・重複投稿対策が皆無。荒らし1人でスレッドが機能停止するリスク。管理画面(`app/admin`)の通報処理はあるが事後対応のみ。

## 指示
1. **DBベースのレート制限**(外部サービス不要の方式):
   - migration `add_rate_limits.sql`: `rate_limit_events (key text, action text, created_at timestamptz)` + index。keyはuser_id または voter_key/IPハッシュ
   - `lib/rate-limit.ts`: `checkRateLimit(key, action, maxCount, windowSeconds)` を実装(security definer関数でカウント+挿入をアトミックに)
   - 制限値の目安: スレ作成 3/時、投稿 10/分、レビュー 5/時、リアクション 30/分、通報 10/時
   - 超過時はServer Actionから日本語エラー「投稿間隔が短すぎます。しばらく待ってから再度お試しください」を返す(既存のエラー返却形式に合わせる)
2. **重複投稿防止**: 同一key・同一本文の投稿を60秒以内は拒否
3. **連投時のクールダウン表示**: フォーム側は既存のエラー表示機構をそのまま使う(新UIは不要)
4. **NGワードの下地**: `lib/moderation.ts` に禁止パターン配列(URL大量貼り付け、過度な繰り返し文字の正規表現チェック)を実装し投稿系アクションで検査。単語リスト自体は空でよい(運用で追加)
5. 古いrate_limit_eventsの削除: 挿入時に `created_at < now() - interval '1 day'` を確率的(1/50)に削除する方式でよい

## 受け入れ条件
- 制限超過で投稿が拒否され、日本語エラーが表示される
- 正常な利用ペースでは制限に当たらない
- 匿名ユーザー(voter_key)にも制限が効く
- `npm run build` 成功
