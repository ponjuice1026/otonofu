# P0: リストページの壊れたJSXを修正

## 前提
otonofu: Next.js 16 App Router / TypeScript / Tailwind 4 / Supabase。UIは日本語・ダークテーマ。

## 問題
`app/lists/page.tsx` (13行) がJSX閉じタグなしで終わっており、ビルドが壊れる可能性が高い。
ファイルは `</header>` で途切れていて、`</div>`・`return` の閉じ・`}` がない。

## 指示
1. `app/lists/page.tsx` を構文的に完結させる
2. 本格実装(04-lists-feature.md)は別タスクなので、ここでは「準備中」プレースホルダーとして完成させる:
   - 既存の `page-shell` / `page-header` / `page-title` / `page-desc` クラス(globals.css)を維持
   - 「リスト機能は準備中です」の案内と、`/albums` へのリンクを表示
3. `npm run build` が通ることを確認

## 受け入れ条件
- ビルド成功、`/lists` が500やビルドエラーなく表示される
- 他ファイルへの変更なし
