/**
 * シード対象で「DB に無いアルバム」を Spotify 検索で直接取得して albums に投入する。
 *
 * 通常の同期はアーティスト名から 1 エンティティ分の配信を辿るだけなので、
 * 別アーティスト表記・未取得などで漏れるアルバムがある。本スクリプトは
 * data/seed-reviews.json の各作品を spotify_query で個別検索し、該当アルバム
 * （+必要なら未登録アーティスト）を登録する。既存の変換関数を再利用。
 *
 * 実行（あなたのPCで。tsx が必要）:
 *   npm run import:missing -- --dry   … 検索結果の確認のみ（書き込みなし）
 *   npm run import:missing            … albums へ投入
 * 実行後に:
 *   npm run seed:reviews             … レビュー/口コミ/スレを紐付け
 *   npm run backfill:tracks          … （任意）曲情報を補完
 *
 * .env.local に NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY /
 * SPOTIFY_CLIENT_ID / SPOTIFY_CLIENT_SECRET が必要。
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { createAdminClient } from "../lib/supabase/admin";
import { searchSpotify } from "../lib/spotify/api";
import {
  transformAlbum,
  transformArtist,
  fetchSpotifyArtistById,
  resolveAlbumId,
} from "../lib/spotify/sync";
import type { SpotifyAlbum } from "../lib/spotify/types";

type SeedReview = { artist: string; album: string; spotify_query?: string; year?: number };

function loadEnvLocal() {
  const p = resolve(process.cwd(), ".env.local");
  if (!existsSync(p)) return;
  for (const line of readFileSync(p, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i < 0) continue;
    const k = t.slice(0, i).trim();
    const v = t.slice(i + 1).trim().replace(/^["']|["']$/g, "");
    if (!process.env[k]) process.env[k] = v;
  }
}

function norm(s: string): string {
  return (s ?? "").normalize("NFKC").toLowerCase().replace(/[\s　・.,'"’”“`~!?！？&＆()（）\[\]「」『』/／-]/g, "");
}
function titleScore(a: string, b: string): number {
  const d = norm(a), t = norm(b);
  if (!d || !t) return 0;
  if (d === t) return 3;
  if (t.length >= 4 && d.startsWith(t)) return 2; // seed 側と同じ「接尾辞一致」
  return 0;
}

type AlbumRow = { id: string; title: string; artist_id: string; year: number | null };
type ArtistRow = { id: string; name: string; name_en: string | null; spotify_id: string | null };

async function fetchAll<T>(fp: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>): Promise<T[]> {
  const out: T[] = [];
  for (let page = 0; ; page++) {
    const from = page * 1000;
    const { data, error } = await fp(from, from + 999);
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) break;
    out.push(...data);
    if (data.length < 1000) break;
  }
  return out;
}

function existsAlbum(entry: SeedReview, albums: AlbumRow[]): boolean {
  // seed-reviews.mjs のマッチ条件と同じ: 接尾辞一致(>=2)の候補が 1 つでもあれば「登録済み」
  return albums.some((a) => titleScore(a.title, entry.album) >= 2);
}

// 検索結果から最も妥当なアルバムを選ぶ
function pickAlbum(entry: SeedReview, items: SpotifyAlbum[]): SpotifyAlbum | null {
  const scored = items
    .map((it) => ({ it, s: titleScore(it.name, entry.album), artistOk: it.artists.some((ar) => {
      const n = norm(ar.name), t = norm(entry.artist);
      return n === t || n.includes(t) || t.includes(n);
    }) }))
    .filter((x) => x.s >= 2)
    .sort((a, b) => (b.s - a.s) || (Number(b.artistOk) - Number(a.artistOk)));
  return scored[0]?.it ?? null;
}

async function main() {
  loadEnvLocal();
  const dry = process.argv.includes("--dry");
  const seed = JSON.parse(readFileSync(resolve(process.cwd(), "data/seed-reviews.json"), "utf8")) as { reviews: SeedReview[] };
  const sb = createAdminClient();

  const albums = await fetchAll<AlbumRow>((f, t) => sb.from("albums").select("id, title, artist_id, year").range(f, t));
  const dbArtists = await fetchAll<ArtistRow>((f, t) => sb.from("artists").select("id, name, name_en, spotify_id").range(f, t));
  const artistBySpotify = new Map(dbArtists.filter((a) => a.spotify_id).map((a) => [a.spotify_id as string, a.id]));

  const missing = seed.reviews.filter((r) => !existsAlbum(r, albums));
  console.log(`対象(DB未登録): ${missing.length} 件\n`);

  let imported = 0, skipped = 0;
  for (const r of missing) {
    const query = r.spotify_query || `${r.artist} ${r.album}`;
    let items: SpotifyAlbum[] = [];
    try {
      const res = await searchSpotify(query, "album", 10);
      items = res.albums?.items ?? [];
    } catch (e) {
      console.log(`  ⚠️ 検索失敗: ${r.artist} / ${r.album} (${e instanceof Error ? e.message : e})`);
      skipped++; continue;
    }
    const hit = pickAlbum(r, items);
    if (!hit) {
      console.log(`  ⚠️ 該当なし: ${r.artist} / ${r.album}（候補: ${items.slice(0, 3).map((i) => i.name).join(", ") || "なし"}）`);
      skipped++; continue;
    }
    console.log(`  🎯 ${r.artist} / ${r.album} → "${hit.name}" [${hit.artists.map((a) => a.name).join(", ")}] ${hit.release_date?.slice(0, 4) ?? ""}`);
    if (dry) continue;

    // アーティストを解決（DB に spotify_id 一致があれば再利用、無ければ取得して登録）
    const spArtist = hit.artists[0];
    let artistId = spArtist ? artistBySpotify.get(spArtist.id) : undefined;
    let genres: string[] = [];
    if (!artistId && spArtist) {
      try {
        const { artist, albums: aAlbums } = await fetchSpotifyArtistById(spArtist.id);
        genres = artist.genres ?? [];
        const artistRow = transformArtist(artist, aAlbums, spArtist.name);
        const { error } = await sb.from("artists").upsert(artistRow, { onConflict: "id" });
        if (error) throw new Error(error.message);
        artistId = artistRow.id;
        artistBySpotify.set(spArtist.id, artistId);
        console.log(`     ＋アーティスト登録: ${artistRow.name}`);
      } catch (e) {
        console.log(`     ⚠️ アーティスト登録失敗: ${e instanceof Error ? e.message : e}`);
        skipped++; continue;
      }
    }
    if (!artistId) { console.log("     ⚠️ artist_id 解決できず"); skipped++; continue; }

    const albumRow = transformAlbum(hit, artistId, genres);
    if (!albumRow) { console.log("     ⚠️ album_type 対象外(single等)でスキップ"); skipped++; continue; }
    const { error } = await sb.from("albums").upsert(albumRow, { onConflict: "id" });
    if (error) { console.log(`     ⚠️ album upsert 失敗: ${error.message}`); skipped++; continue; }
    imported++;
  }

  console.log(`\n──────── 完了 ────────`);
  console.log(`登録: ${imported} 件 / スキップ: ${skipped} 件`);
  if (dry) console.log("(DRY RUN のため書き込みなし)");
  else console.log("次に: npm run seed:reviews で紐付け → 必要なら npm run backfill:tracks");
}

main().catch((e) => {
  console.error("\n❌ エラー:", e instanceof Error ? e.message : e);
  process.exit(1);
});
