/**
 * 初期シードレビュー投入スクリプト
 *
 * data/seed-reviews.json の運営レビュー・匿名口コミ・議論スレを Supabase に直接投入する。
 * 冪等（何度実行しても重複しない）。既存レビューは更新、口コミ・スレは同一内容があればスキップ。
 *
 * アプリと同じデータ形状に正規化して投入する:
 *   - 項目評価(歌詞/メロディ/演奏技術/雰囲気/完成度)は 0〜10 の整数（スライダー入力に一致）
 *   - 総合 rating は 5 項目の平均（小数1桁）= averageCriteriaRatings と同じ
 *   - albums.avg_rating / rating_count は reviews への挿入トリガーで自動再計算されるため触らない
 *
 * 事前準備:
 *   1) 対象アルバムを Spotify 同期済みにしておく（npm run sync:spotify 等）
 *   2) 編集部用のアカウントを 1 つ作り、その auth ユーザー ID を控える
 *      （Supabase Dashboard → Authentication → Users で確認できる UUID）
 *
 * 実行:
 *   SEED_EDITOR_USER_ID=<uuid> npm run seed:reviews          … 実投入
 *   SEED_EDITOR_USER_ID=<uuid> npm run seed:reviews -- --dry … マッチ確認のみ（書き込みなし）
 *
 * 任意 env:
 *   SEED_EDITOR_NAME=編集部   … レビューの表示名（未指定ならプロフィールの display_name/username）
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { webcrypto } from "node:crypto";
import { createAdminClient } from "../lib/supabase/admin";

// ---- 型 ----
type SeedComment = { anonymous_name: string; body: string };
type SeedReview = {
  artist: string;
  album: string;
  spotify_query?: string;
  year?: number;
  rating: number;
  rating_lyrics: number;
  rating_melody: number;
  rating_performance: number;
  rating_atmosphere: number;
  rating_completion: number;
  body: string;
  comments: SeedComment[];
};
type SeedThread = { title: string; album_hint: string | null; body: string };
type SeedFile = { reviews: SeedReview[]; discussion_threads: SeedThread[] };

// 表示ラベル（順序は reviews.rating_* カラムに対応）
const CRITERIA_LABELS = ["歌詞", "メロディ", "演奏技術", "雰囲気", "完成度"];

// ---- env ----
function loadEnvLocal() {
  const envPath = resolve(process.cwd(), ".env.local");
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq === -1) continue;
    const k = t.slice(0, eq).trim();
    const v = t.slice(eq + 1).trim();
    if (!process.env[k]) process.env[k] = v;
  }
}

// ---- 正規化 & マッチング ----
function norm(s: string): string {
  return (s ?? "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\s　・.,'"’”“`~!?！？&＆()（）\[\]「」『』/／-]/g, "");
}

type AlbumRow = { id: string; title: string; artist_id: string; year: number | null };
type ArtistRow = { id: string; name: string; name_en: string | null };

// アプリと同じ扱いに正規化: 項目は整数、総合は5項目平均(小数1桁)
type NormalizedRatings = {
  lyrics: number;
  melody: number;
  performance: number;
  atmosphere: number;
  completion: number;
  overall: number;
};
function normalizeRatings(r: SeedReview): NormalizedRatings {
  const lyrics = Math.round(r.rating_lyrics);
  const melody = Math.round(r.rating_melody);
  const performance = Math.round(r.rating_performance);
  const atmosphere = Math.round(r.rating_atmosphere);
  const completion = Math.round(r.rating_completion);
  const overall =
    Math.round(((lyrics + melody + performance + atmosphere + completion) / 5) * 10) / 10;
  return { lyrics, melody, performance, atmosphere, completion, overall };
}

function matchAlbum(
  entry: { artist: string; album: string; year?: number },
  albums: AlbumRow[],
  artistsById: Map<string, ArtistRow>,
): { album: AlbumRow | null; ambiguous: boolean } {
  const targetTitle = norm(entry.album);
  const targetArtist = norm(entry.artist);
  if (!targetTitle) return { album: null, ambiguous: false };

  let titleHits = albums.filter((a) => {
    const t = norm(a.title);
    return t === targetTitle || t.includes(targetTitle) || targetTitle.includes(t);
  });
  if (titleHits.length === 0) return { album: null, ambiguous: false };

  // アーティスト名（name / name_en）で絞り込み
  const artistFiltered = titleHits.filter((a) => {
    const ar = artistsById.get(a.artist_id);
    if (!ar) return false;
    const n = norm(ar.name);
    const ne = norm(ar.name_en ?? "");
    return (
      (n && (n.includes(targetArtist) || targetArtist.includes(n))) ||
      (ne && (ne.includes(targetArtist) || targetArtist.includes(ne)))
    );
  });
  if (artistFiltered.length > 0) titleHits = artistFiltered;

  // 完全一致タイトルを優先
  const exact = titleHits.filter((a) => norm(a.title) === targetTitle);
  const pool = exact.length > 0 ? exact : titleHits;

  // 版ちがいが複数 → year が近いものを優先
  let best = pool[0];
  if (pool.length > 1 && entry.year) {
    best = pool.reduce((acc, cur) => {
      const da = Math.abs((acc.year ?? 9999) - entry.year!);
      const dc = Math.abs((cur.year ?? 9999) - entry.year!);
      return dc < da ? cur : acc;
    }, pool[0]);
  }
  return { album: best, ambiguous: pool.length > 1 };
}

async function fetchAll<T>(
  fetchPage: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
): Promise<T[]> {
  const out: T[] = [];
  const size = 1000;
  for (let page = 0; ; page++) {
    const from = page * size;
    const { data, error } = await fetchPage(from, from + size - 1);
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) break;
    out.push(...data);
    if (data.length < size) break;
  }
  return out;
}

function threadBody(r: SeedReview, n: NormalizedRatings): string {
  const parts: string[] = [];
  if (r.body.trim()) parts.push(r.body.trim());
  parts.push(`総合評価: ${n.overall}/10`);
  const critVals = [n.lyrics, n.melody, n.performance, n.atmosphere, n.completion];
  parts.push(CRITERIA_LABELS.map((label, i) => `${label} ${critVals[i]}`).join(" · "));
  return parts.join("\n\n").slice(0, 4000);
}

function uuid(): string {
  return webcrypto.randomUUID();
}

async function main() {
  loadEnvLocal();
  const dryRun = process.argv.includes("--dry");
  const editorId = process.env.SEED_EDITOR_USER_ID;
  if (!editorId) {
    console.error(
      "❌ SEED_EDITOR_USER_ID が未設定です。編集部アカウントの auth ユーザー ID(UUID)を指定してください。\n" +
        "   例: SEED_EDITOR_USER_ID=xxxxxxxx-... npm run seed:reviews",
    );
    process.exit(1);
  }

  const seedPath = resolve(process.cwd(), "data/seed-reviews.json");
  const seed = JSON.parse(readFileSync(seedPath, "utf8")) as SeedFile;

  const supabase = createAdminClient();

  // 編集部プロフィール
  const { data: profile, error: profErr } = await supabase
    .from("profiles")
    .select("id, username, display_name")
    .eq("id", editorId)
    .maybeSingle();
  if (profErr) throw new Error(`profiles 取得失敗: ${profErr.message}`);
  if (!profile) {
    console.error(
      `❌ profiles に ${editorId} が見つかりません。先にそのアカウントでログイン/登録し、プロフィールを作成してください。`,
    );
    process.exit(1);
  }
  const username =
    process.env.SEED_EDITOR_NAME ?? profile.display_name ?? profile.username;

  // アーティスト & アルバム全件
  const artists = await fetchAll<ArtistRow>((from, to) =>
    supabase.from("artists").select("id, name, name_en").range(from, to),
  );
  const artistsById = new Map(artists.map((a) => [a.id, a]));
  const albums = await fetchAll<AlbumRow>((from, to) =>
    supabase.from("albums").select("id, title, artist_id, year").range(from, to),
  );
  console.log(`📚 DB: アーティスト ${artists.length} / アルバム ${albums.length}`);
  console.log(`👤 編集部: ${username} (${editorId})`);
  console.log(dryRun ? "🔎 DRY RUN（書き込みなし）\n" : "✍️  投入モード\n");

  const unmatched: string[] = [];
  let reviewsInserted = 0,
    reviewsUpdated = 0,
    commentsInserted = 0,
    threadsUpserted = 0;

  for (const r of seed.reviews) {
    const { album, ambiguous } = matchAlbum(r, albums, artistsById);
    if (!album) {
      unmatched.push(`${r.artist} / ${r.album}`);
      console.log(`  ⚠️  未マッチ: ${r.artist} / ${r.album}（要 Spotify 同期 or タイトル確認）`);
      continue;
    }
    const flag = ambiguous ? " ⚠️版ちがい候補あり(year優先で選択)" : "";
    console.log(`  ✅ ${r.artist} / ${r.album} → "${album.title}" (${album.year ?? "?"}) ${album.id}${flag}`);
    if (dryRun) continue;

    const now = new Date().toISOString();
    const n = normalizeRatings(r);
    const payload = {
      album_id: album.id,
      album_title: album.title,
      artist_id: album.artist_id,
      user_id: editorId,
      username,
      rating: n.overall,
      rating_lyrics: n.lyrics,
      rating_melody: n.melody,
      rating_performance: n.performance,
      rating_atmosphere: n.atmosphere,
      rating_completion: n.completion,
      body: r.body,
      updated_at: now,
      session_opt_out: false,
    };

    // レビュー upsert（user_id + album_id で一意）
    const { data: existing } = await supabase
      .from("reviews")
      .select("id")
      .eq("user_id", editorId)
      .eq("album_id", album.id)
      .maybeSingle();

    let reviewId: string;
    if (existing) {
      reviewId = existing.id;
      const { error } = await supabase.from("reviews").update(payload).eq("id", reviewId);
      if (error) throw new Error(`review update 失敗 (${r.album}): ${error.message}`);
      reviewsUpdated++;
    } else {
      reviewId = uuid();
      const { error } = await supabase
        .from("reviews")
        .insert({ id: reviewId, created_at: now, ...payload });
      if (error) throw new Error(`review insert 失敗 (${r.album}): ${error.message}`);
      reviewsInserted++;
    }

    // レビューセッション（discussion_threads）を upsert
    const tBody = threadBody(r, n);
    const tTitle = `${album.title} のレビュー`.slice(0, 120);
    const { data: exThread } = await supabase
      .from("discussion_threads")
      .select("id")
      .eq("review_id", reviewId)
      .maybeSingle();
    if (exThread) {
      await supabase
        .from("discussion_threads")
        .update({ title: tTitle, body: tBody, album_id: album.id, status: "published", updated_at: now })
        .eq("id", exThread.id);
    } else {
      await supabase.from("discussion_threads").insert({
        author_id: editorId,
        title: tTitle,
        body: tBody,
        status: "published",
        review_id: reviewId,
        album_id: album.id,
        created_at: now,
        updated_at: now,
      });
    }

    // 口コミ（重複回避: 同一 review + 同一 name + 同一 body があればスキップ）
    const { data: exComments } = await supabase
      .from("review_comments")
      .select("anonymous_name, body")
      .eq("review_id", reviewId);
    const seen = new Set((exComments ?? []).map((c) => `${c.anonymous_name} ${c.body}`));
    for (const c of r.comments) {
      const key = `${c.anonymous_name} ${c.body}`;
      if (seen.has(key)) continue;
      const { error } = await supabase.from("review_comments").insert({
        review_id: reviewId,
        author_id: null,
        anonymous_name: c.anonymous_name.slice(0, 24),
        body: c.body.slice(0, 2000),
        parent_comment_id: null,
      });
      if (error) throw new Error(`comment insert 失敗 (${r.album}): ${error.message}`);
      seen.add(key);
      commentsInserted++;
    }
  }

  // 独立した議論スレ（火種）
  for (const t of seed.discussion_threads) {
    let albumId: string | null = null;
    if (t.album_hint) {
      const tokens = t.album_hint.split(/\s+/);
      const hint = { artist: tokens[0] ?? t.album_hint, album: tokens.slice(1).join(" ") || t.album_hint };
      albumId = matchAlbum(hint, albums, artistsById).album?.id ?? null;
    }
    console.log(`  🔥 スレ: ${t.title}${albumId ? ` (album_id=${albumId})` : ""}`);
    if (dryRun) continue;

    const { data: ex } = await supabase
      .from("discussion_threads")
      .select("id")
      .eq("author_id", editorId)
      .eq("title", t.title)
      .is("review_id", null)
      .maybeSingle();
    if (ex) continue;
    const now = new Date().toISOString();
    const { error } = await supabase.from("discussion_threads").insert({
      author_id: editorId,
      title: t.title,
      body: t.body,
      status: "published",
      review_id: null,
      album_id: albumId,
      created_at: now,
      updated_at: now,
    });
    if (error) throw new Error(`thread insert 失敗 (${t.title}): ${error.message}`);
    threadsUpserted++;
  }

  console.log("\n──────── 完了 ────────");
  console.log(`レビュー: 新規 ${reviewsInserted} / 更新 ${reviewsUpdated}`);
  console.log(`口コミ: 新規 ${commentsInserted}`);
  console.log(`議論スレ(火種): 新規 ${threadsUpserted}`);
  if (unmatched.length) {
    console.log(`\n⚠️ 未マッチ ${unmatched.length} 件（Spotify 同期 or タイトル表記を確認）:`);
    unmatched.forEach((u) => console.log(`  - ${u}`));
  }
  if (dryRun) console.log("\n(DRY RUN のため書き込みは行っていません)");
}

main().catch((e) => {
  console.error("\n❌ エラー:", e instanceof Error ? e.message : e);
  process.exit(1);
});
