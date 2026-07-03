/**
 * 初期シードレビュー投入スクリプト（素の Node 版 / tsx 不要）
 *
 * data/seed-reviews.json の運営レビュー・匿名口コミ・議論スレを Supabase に直接投入する。
 * 冪等（何度実行しても重複しない）。アプリと同じ形状に正規化して入れる:
 *   - 項目評価は 0〜10 の整数、総合 rating は 5 項目平均（小数1桁）
 *   - albums.avg_rating / rating_count は挿入トリガーが自動再計算するので触らない
 *
 * 事前準備:
 *   - 対象アルバムを Spotify 同期済みにしておく（npm run sync:spotify 等）
 *   - .env.local に NEXT_PUBLIC_SUPABASE_URL と SUPABASE_SERVICE_ROLE_KEY があること
 *
 * 実行（あなたのPCで）:
 *   npm run seed:reviews -- --dry   … マッチ確認のみ（書き込みなし）
 *   npm run seed:reviews            … 実投入
 *
 * 投稿者アカウント（任意・未指定なら「otonofu編集部」を自動作成/再利用）:
 *   SEED_EDITOR_USER_ID=<uuid>   … 既存アカウントを使う
 *   SEED_EDITOR_NAME=編集部       … 表示名を変える
 *   SEED_EDITOR_EMAIL=...         … 自動作成する編集部アカウントのメール
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { webcrypto } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const CRITERIA_LABELS = ["歌詞", "メロディ", "演奏技術", "雰囲気", "完成度"];

function loadEnvLocal() {
  const p = resolve(process.cwd(), ".env.local");
  let raw;
  try { raw = readFileSync(p, "utf8"); } catch { return; }
  for (const line of raw.split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i < 0) continue;
    const k = t.slice(0, i).trim();
    let v = t.slice(i + 1).trim().replace(/^["']|["']$/g, "");
    if (!process.env[k]) process.env[k] = v;
  }
}

function norm(s) {
  return (s ?? "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\s　・.,'"’”“`~!?！？&＆()（）\[\]「」『』/／-]/g, "");
}

function normalizeRatings(r) {
  const lyrics = Math.round(r.rating_lyrics);
  const melody = Math.round(r.rating_melody);
  const performance = Math.round(r.rating_performance);
  const atmosphere = Math.round(r.rating_atmosphere);
  const completion = Math.round(r.rating_completion);
  const overall =
    Math.round(((lyrics + melody + performance + atmosphere + completion) / 5) * 10) / 10;
  return { lyrics, melody, performance, atmosphere, completion, overall };
}

// タイトル一致スコア: 3=完全一致 / 2=リイシュー等の接尾辞付き(前方一致) / 0=不一致
// 短いタイトル("O""R""音楽""TIME"等)への誤爆を防ぐため、ゆるい部分一致はしない。
function titleScore(dbTitle, target) {
  const d = norm(dbTitle);
  const t = norm(target);
  if (!d || !t) return 0;
  if (d === t) return 3;
  // DB 側が「target + 接尾辞」(例: "VARIETY (30th Anniversary Edition)")のリイシュー
  if (t.length >= 4 && d.startsWith(t)) return 2;
  return 0;
}

function artistMatches(album, targetArtist, artistsById) {
  const ar = artistsById.get(album.artist_id);
  if (!ar) return false;
  const n = norm(ar.name);
  const ne = norm(ar.name_en ?? "");
  const ta = targetArtist;
  return (
    (n && (n === ta || n.includes(ta) || ta.includes(n))) ||
    (ne && (ne === ta || ne.includes(ta) || ta.includes(ne)))
  );
}

function matchAlbum(entry, albums, artistsById) {
  const targetTitle = norm(entry.album);
  const targetArtist = norm(entry.artist);
  if (!targetTitle) return { album: null, ambiguous: false };

  let cands = [];
  for (const a of albums) {
    const s = titleScore(a.title, entry.album);
    if (s > 0) cands.push({ a, s });
  }
  if (cands.length === 0) return { album: null, ambiguous: false };

  // アーティスト一致で絞り込み（名前表記ゆれで空になることがあるので、その場合は全候補を維持）
  const withArtist = cands.filter((c) => artistMatches(c.a, targetArtist, artistsById));
  const pool = withArtist.length > 0 ? withArtist : cands;

  // スコア最上位（完全一致 > 接尾辞一致）を優先
  const maxScore = Math.max(...pool.map((c) => c.s));
  const top = pool.filter((c) => c.s === maxScore);

  let best = top[0].a;
  if (top.length > 1 && entry.year) {
    best = top.reduce((acc, cur) => {
      const da = Math.abs((acc.a.year ?? 9999) - entry.year);
      const dc = Math.abs((cur.a.year ?? 9999) - entry.year);
      return dc < da ? cur : acc;
    }, top[0]).a;
  }
  return {
    album: best,
    ambiguous: top.length > 1,
    exact: maxScore === 3,
    viaArtist: withArtist.length > 0,
  };
}

async function fetchAll(fetchPage) {
  const out = [];
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

function threadBody(r, n) {
  const parts = [];
  if (r.body.trim()) parts.push(r.body.trim());
  parts.push(`総合評価: ${n.overall}/10`);
  const critVals = [n.lyrics, n.melody, n.performance, n.atmosphere, n.completion];
  parts.push(CRITERIA_LABELS.map((label, i) => `${label} ${critVals[i]}`).join(" · "));
  return parts.join("\n\n").slice(0, 4000);
}

async function resolveEditor(sb) {
  const overrideName = process.env.SEED_EDITOR_NAME;
  // 1) UUID 指定
  if (process.env.SEED_EDITOR_USER_ID) {
    const id = process.env.SEED_EDITOR_USER_ID;
    const { data, error } = await sb
      .from("profiles")
      .select("id, username, display_name")
      .eq("id", id)
      .maybeSingle();
    if (error) throw new Error(`profiles 取得失敗: ${error.message}`);
    if (!data) throw new Error(`指定 SEED_EDITOR_USER_ID のプロフィールが見つかりません: ${id}`);
    return { id: data.id, name: overrideName ?? data.display_name ?? data.username };
  }

  const desiredName = overrideName ?? "otonofu編集部";
  // 2) 既存の編集部アカウントを再利用
  for (const col of ["display_name", "username"]) {
    const { data } = await sb.from("profiles").select("id, username, display_name").eq(col, desiredName).limit(1);
    if (data && data.length) return { id: data[0].id, name: desiredName };
  }

  // 3) 自動作成
  const email = process.env.SEED_EDITOR_EMAIL ?? "editor@otonofu.app";
  const password = process.env.SEED_EDITOR_PASSWORD ?? webcrypto.randomUUID() + "Aa1!";
  const { data: created, error } = await sb.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { display_name: desiredName },
  });
  if (error) {
    // 既に同メールが存在する場合はそれを使う
    const { data: list } = await sb.auth.admin.listUsers();
    const hit = list?.users?.find((u) => u.email === email);
    if (!hit) throw new Error(`編集部アカウント作成失敗: ${error.message}`);
    await sb.from("profiles").update({ display_name: desiredName }).eq("id", hit.id);
    return { id: hit.id, name: desiredName };
  }
  const id = created.user.id;
  // プロフィール（トリガー生成）に display_name を反映。無ければ upsert。
  const { error: upErr } = await sb
    .from("profiles")
    .upsert({ id, username: `otonofu_editor_${id.slice(0, 8)}`, display_name: desiredName }, { onConflict: "id" });
  if (upErr) console.log("  (profiles upsert 注意:", upErr.message, ")");
  console.log(`  🆕 編集部アカウントを作成: ${email} / パスワード: ${password}`);
  console.log("     ※このメール/パスワードは控えてください（後でログイン・パスワード変更可）");
  return { id, name: desiredName };
}

async function main() {
  loadEnvLocal();
  const dryRun = process.argv.includes("--dry");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("❌ NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY が .env.local にありません。");
    process.exit(1);
  }

  const seed = JSON.parse(readFileSync(resolve(process.cwd(), "data/seed-reviews.json"), "utf8"));
  const sb = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

  const editor = await resolveEditor(sb);

  const artists = await fetchAll((from, to) =>
    sb.from("artists").select("id, name, name_en").range(from, to),
  );
  const artistsById = new Map(artists.map((a) => [a.id, a]));
  const albums = await fetchAll((from, to) =>
    sb.from("albums").select("id, title, artist_id, year").range(from, to),
  );
  console.log(`📚 DB: アーティスト ${artists.length} / アルバム ${albums.length}`);
  console.log(`👤 編集部: ${editor.name} (${editor.id})`);
  console.log(dryRun ? "🔎 DRY RUN（書き込みなし）\n" : "✍️  投入モード\n");

  const unmatched = [];
  let rIns = 0, rUpd = 0, cIns = 0, tIns = 0;

  for (const r of seed.reviews) {
    const { album, ambiguous, exact, viaArtist } = matchAlbum(r, albums, artistsById);
    if (!album) {
      unmatched.push(`${r.artist} / ${r.album}`);
      console.log(`  ⚠️  未マッチ: ${r.artist} / ${r.album}`);
      continue;
    }
    const tags = [];
    if (!exact) tags.push("接尾辞一致(リイシュー等)");
    if (!viaArtist) tags.push("アーティスト名は表記ゆれ");
    if (ambiguous) tags.push("複数候補→year優先");
    console.log(
      `  ✅ ${r.artist} / ${r.album} → "${album.title}" (${album.year ?? "?"})` +
        (tags.length ? `  [${tags.join(" / ")}]` : ""),
    );
    if (dryRun) continue;

    const now = new Date().toISOString();
    const n = normalizeRatings(r);
    const payload = {
      album_id: album.id,
      album_title: album.title,
      artist_id: album.artist_id,
      user_id: editor.id,
      username: editor.name,
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

    const { data: existing } = await sb
      .from("reviews").select("id").eq("user_id", editor.id).eq("album_id", album.id).maybeSingle();

    let reviewId;
    if (existing) {
      reviewId = existing.id;
      const { error } = await sb.from("reviews").update(payload).eq("id", reviewId);
      if (error) throw new Error(`review update 失敗 (${r.album}): ${error.message}`);
      rUpd++;
    } else {
      reviewId = webcrypto.randomUUID();
      const { error } = await sb.from("reviews").insert({ id: reviewId, created_at: now.slice(0, 10), ...payload });
      if (error) throw new Error(`review insert 失敗 (${r.album}): ${error.message}`);
      rIns++;
    }

    // レビューセッション（discussion_threads）
    const tBody = threadBody(r, n);
    const tTitle = `${album.title} のレビュー`.slice(0, 120);
    const { data: exT } = await sb.from("discussion_threads").select("id").eq("review_id", reviewId).maybeSingle();
    if (exT) {
      await sb.from("discussion_threads")
        .update({ title: tTitle, body: tBody, album_id: album.id, status: "published", updated_at: now })
        .eq("id", exT.id);
    } else {
      await sb.from("discussion_threads").insert({
        author_id: editor.id, title: tTitle, body: tBody, status: "published",
        review_id: reviewId, album_id: album.id, created_at: now, updated_at: now,
      });
    }

    // 口コミ（重複回避）
    const { data: exC } = await sb.from("review_comments").select("anonymous_name, body").eq("review_id", reviewId);
    const seen = new Set((exC ?? []).map((c) => `${c.anonymous_name} ${c.body}`));
    for (const c of r.comments) {
      const k = `${c.anonymous_name} ${c.body}`;
      if (seen.has(k)) continue;
      const { error } = await sb.from("review_comments").insert({
        review_id: reviewId, author_id: null,
        anonymous_name: c.anonymous_name.slice(0, 24), body: c.body.slice(0, 2000), parent_comment_id: null,
      });
      if (error) throw new Error(`comment insert 失敗 (${r.album}): ${error.message}`);
      seen.add(k); cIns++;
    }
  }

  // 独立した議論スレ（火種）
  for (const t of seed.discussion_threads) {
    let albumId = null;
    if (t.album_hint) {
      const tokens = t.album_hint.split(/\s+/);
      const hint = { artist: tokens[0] ?? t.album_hint, album: tokens.slice(1).join(" ") || t.album_hint };
      albumId = matchAlbum(hint, albums, artistsById).album?.id ?? null;
    }
    console.log(`  🔥 スレ: ${t.title}${albumId ? ` (album_id=${albumId})` : ""}`);
    if (dryRun) continue;

    const { data: ex } = await sb
      .from("discussion_threads").select("id").eq("author_id", editor.id).eq("title", t.title).is("review_id", null).maybeSingle();
    if (ex) continue;
    const now = new Date().toISOString();
    const { error } = await sb.from("discussion_threads").insert({
      author_id: editor.id, title: t.title, body: t.body, status: "published",
      review_id: null, album_id: albumId, created_at: now, updated_at: now,
    });
    if (error) throw new Error(`thread insert 失敗 (${t.title}): ${error.message}`);
    tIns++;
  }

  console.log("\n──────── 完了 ────────");
  console.log(`レビュー: 新規 ${rIns} / 更新 ${rUpd}`);
  console.log(`口コミ: 新規 ${cIns}`);
  console.log(`議論スレ(火種): 新規 ${tIns}`);
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
