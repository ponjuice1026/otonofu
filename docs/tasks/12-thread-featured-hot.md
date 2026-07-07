# P1: セッションの「運営ピックアップ」「いま一番ホット」表示

## 前提(共通)

otonofu: Next.js 16 App Router / TypeScript / Supabase (RLS必須)。データ層は `lib/data/`、Server Actions は `app/**/actions.ts`、型は `lib/types.ts`、migrations は `supabase/migrations/` に新規ファイル追加。UIは日本語・zinc系ダークテーマ。**実装前に `node_modules/next/dist/docs/` を確認。**

## 背景

`discussion_threads`（＝セッション）には2系統が混在している。

- **レビュー由来のセッション**: `review_id` / `album_id` あり。実質「アルバムのコメント」。既存レビューを自動セッション化する `add_review_sessions.sql` で大量に生成される。
- **議論トピック**: `review_id` が null。ユーザーが `/threads/new` で立てる話題。投票（poll）を持てる。

一覧 `/threads` は「いま話題のセッション」（`getTrendingThreads` のスコア順）＋「すべてのセッション」（新着順）の2セクションで、**両系統が完全に同列**。結果として、運営が推したい議論も、自動生成された大量のアルバムコメントも横並びになり、「運営の一押し」も「本当にホットな話題」も埋もれる。

## ゴール

1. **運営ピックアップ（手動）**: 管理者が特定セッションを手動で「一押し」に指定し、専用セクションで最上部に出す。任意で一言コメントと並び順を付けられる。
2. **いま一番ホット（自動）**: 直近の実活動（新規投稿・閲覧）を重視したスコアで自動抽出。ピックアップと重複させない。
3. **種別の可視化（バッジのみ）**: 各行に「アルバム」/「議論」バッジを付け、系統を判別可能にする。リストの分割・タブは今回はやらない（最小変更）。

方針決定: 運営の一押しは **手動＋自動の併用**、種別は **バッジのみ**。

---

## 1. スキーマ（新規 migration: `add_thread_featured.sql`）

`discussion_threads` に手動ピック用の列を追加する。種別は既存の `review_id` で判定できるため**新カラム不要**。

```sql
-- 運営ピックアップ（手動一押し）
alter table public.discussion_threads
  add column if not exists featured_rank integer,   -- null=非ピック。小さいほど上位（0が最上位）
  add column if not exists featured_note text
    check (featured_note is null or char_length(featured_note) <= 80),
  add column if not exists featured_at timestamptz;

-- ピック済みの取得用（published のみ、rank 昇順）
create index if not exists discussion_threads_featured_idx
  on public.discussion_threads (featured_rank asc)
  where featured_rank is not null;
```

RLS: 管理者による update は既存 `add_admin_role.sql` の「admins can update any thread」ポリシーで許可済み。追加不要。ただし更新は既存の管理系と同様 `createAdminClient()`（service role）経由で行うため、実質ポリシー非依存。

---

## 2. 型の追加

### `lib/supabase/types.ts` — `DbDiscussionThread`

```ts
featured_rank: number | null;
featured_note: string | null;
featured_at: string | null;
```

### `lib/types.ts` — `DiscussionThread`

```ts
kind: "album" | "topic";      // review_id の有無から算出
featuredRank: number | null;  // null=非ピック
featuredNote: string | null;
```

`mapThread`（`lib/data/threads.ts`）で:

```ts
kind: row.review_id ? "album" : "topic",
featuredRank: row.featured_rank ?? null,
featuredNote: row.featured_note ?? null,
```

`select` 文はすべて `*` を使っているので新カラムは自動的に載る。個別 `select("id, title, ...")` の箇所（`getUserThreadDrafts` 等）は今回の表示に無関係なので触らない。

---

## 3. データ層（`lib/data/threads.ts`）

### 3-1. 運営ピックアップ取得（新規）

```ts
export async function getFeaturedThreads(limit = 6): Promise<DiscussionThread[]>
```

- `status = 'published'` かつ `featured_rank is not null`
- `order("featured_rank", { ascending: true })` → `order("featured_at", { ascending: false })`
- `mapThread` で整形。既存の `discussion_posts ( count )` / `discussion_poll_options ( count )` の集計付き select を流用。

### 3-2. ホット抽出の改善（`getTrendingThreads` を強化）

現状は `updated_at` の新しさ（＝最後の投稿時刻）ベースで、`(viewCount + postCount*5 + poll*10) × recencyBoost`。「更新が新しい」だけで、**直近にどれだけ投稿が集中したか**を見ていないため、古い人気スレが `updated_at` の1投稿で上がる／自動生成アルバムコメントが紛れ込みやすい。

改善案（DB追加なしで実装可能）:

1. 候補を直近30日 `updated_at` で絞る（現状維持）。
2. 候補スレIDに対し `discussion_posts` を `created_at >= now()-72h` で引き、**スレ別の直近投稿数** `recentPosts` を集計（1クエリ `in(threadIds)` + JS集計、既存の集計スタイルに合わせる）。
3. スコア:

```
score = (recentPosts * 12)                 // 直近の勢いを最重視
      + (viewCount * 0.15)                  // 閲覧の底上げ
      + (postCount * 2)                     // 累積の会話量
      + (hasPoll ? 8 : 0)                   // 投票は参加動線
      × recencyBoost(updatedAt)             // 既存の 1/log2(ageHours) を維持
```

4. `featured_rank is not null`（＝ピック済み）は**除外**して重複を防ぐ。
5. 任意: `recentPosts === 0 && ageHours > 168` は足切り（過去スレの浮上防止）。

`getTrendingThreads(limit)` のシグネチャは維持。返り値も `DiscussionThread[]` のまま。

> メモ: より正確にやるなら `discussion_posts (created_at)` を数える RPC / マテビューだが、まずは上記のアプリ側集計で十分。投稿量が増えて重くなったら RPC 化を検討（別タスク）。

---

## 4. 管理者操作

### 4-1. Server Action（`app/admin/actions.ts` に追記）

```ts
export async function setThreadFeatured(
  threadId: string,
  rank: number | null,      // null で解除
  note: string | null,
): Promise<AdminActionResult>
```

- 先頭で `requireAdmin()`（既存ヘルパ）。
- `createAdminClient()` で `discussion_threads` を update:
  - ピック時: `{ featured_rank: rank ?? 0, featured_note: note?.trim() || null, featured_at: new Date().toISOString() }`
  - 解除時（`rank === null`）: `{ featured_rank: null, featured_note: null, featured_at: null }`
- `note` は80字上限でバリデーション（超過はエラー返却）。
- `revalidatePath("/admin")` と `revalidatePath("/threads")` の両方。

### 4-2. 管理画面 UI（`components/admin/AdminThreadRow.tsx` + `lib/data/admin.ts`）

- `getAdminThreads()` の返却に `featured_rank` / `featured_note` / `review_id`(種別) を含める。
- 各行に:
  - 種別バッジ（アルバム/議論）
  - 「一押しにする / 解除」トグルボタン（`setThreadFeatured` を呼ぶ）
  - ピック中は並び順（rank）と一言メモの簡易入力（数値 + テキスト、保存で `setThreadFeatured` 再呼び出し）
- 既存の削除ボタン等のパターン（Server Action + `useTransition`）に合わせる。

---

## 5. 一覧 UI（`app/threads/page.tsx`）

セクション構成を次の順に:

1. **運営ピックアップ**（`getFeaturedThreads`、`featuredThreads.length > 0` のときだけ表示）
   - 見出し: 「運営ピックアップ」/ サブ: 「編集部が選ぶ、いま読んでほしい話題」
   - 各カードに `featuredNote` があれば引用風に表示。種別バッジも表示。
2. **いま一番ホット**（`getTrendingThreads`、改善後スコア）
   - 見出しを現行「いま話題のセッション」→「いま一番ホット」に。サブ: 「直近で最も盛り上がっている話題」
3. **すべてのセッション**（現行の新着順を維持）
   - 各行に**種別バッジ**を追加（下記）。

`page.tsx` の `Promise.all` に `getFeaturedThreads(6)` を追加。

### 種別バッジ

`thread.kind === "album" ? "アルバム" : "議論"` を既存 `badge` クラスで表示。既存の「投票あり」バッジの隣に置く。色を分けるなら:

- 議論: `badge`（既存アクセント）
- アルバム: `badge` + 抑えめ（`text-zinc-400` 系のバリアント、必要なら globals.css に `badge-muted` を追加）

「すべてのセッション」行（`app/threads/page.tsx` の `newestThreads.map`）の meta 行に挿入。

### コンポーネント

- 運営ピックアップは `components/thread/TrendingThreadList.tsx` を流用可（`layout="row"`）。`featuredNote` を出したいので、`FeaturedThreadList` を新設するか `TrendingThreadList` に任意 `showNote?: boolean` を足すかのどちらか。**最小変更なら `TrendingThreadList` に prop 追加**。

---

## 6. 受け入れ条件

- migration `add_thread_featured.sql` 適用後、`discussion_threads` に3列が追加される。
- 管理画面から任意セッションを「一押し」指定/解除でき、一言メモと並び順を設定できる。
- `/threads` 最上部に「運営ピックアップ」が出る（ピックが1件以上あるとき）。0件のときはセクション自体が出ない。
- 「いま一番ホット」がピック済みを除外し、直近72hの投稿が多い話題を優先して並べる。
- 「すべてのセッション」の各行に「アルバム」/「議論」バッジが出る。
- ピック済みが「いま一番ホット」に二重表示されない。
- ログアウト状態でも一覧の表示は従来どおり（管理操作のみ管理者限定）。
- `npm run build` 成功。既存の型エラーを増やさない。

## 7. 実装順（推奨）

1. migration 追加（`add_thread_featured.sql`）
2. 型追加（`DbDiscussionThread` / `DiscussionThread` / `mapThread`）
3. `getFeaturedThreads` 追加 + `getTrendingThreads` スコア改善
4. `setThreadFeatured` action + 管理画面 UI
5. `/threads` のセクション追加 + 種別バッジ
6. `npm run build` と目視確認

## 8. 今回スコープ外（別タスク候補）

- 種別ごとのタブ/リスト分割（今回はバッジのみ）。
- ホットスコアの RPC / マテビュー化（投稿量が増えたら）。
- ピックの有効期限（`featured_until`）や自動失効。
- 「運営ピックアップ」のトップページ（`app/page.tsx`）への露出。
