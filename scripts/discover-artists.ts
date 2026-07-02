/**
 * Spotify 検索 API を使って日本のアーティストを自動発見しキューに追加する
 *
 * 実行: npm run discover:artists -- --target=500
 *       npm run discover:artists -- --target=500 --min-followers=2000
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

function loadEnvLocal() {
  const envPath = resolve(process.cwd(), ".env.local");
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (!process.env[key]) process.env[key] = value;
  }
}

function parseFlag(flag: string, fallback: number): number {
  for (const arg of process.argv) {
    if (arg.startsWith(`--${flag}=`)) {
      const value = Number(arg.slice(flag.length + 3));
      if (Number.isFinite(value) && value > 0) return value;
    }
  }
  return fallback;
}

// Spotify の `/search` API へ投げるクエリ群（日本のアーティストを幅広く拾う）
const DISCOVERY_QUERIES = [
  // ジャンル × 国指定
  'genre:"j-pop"',
  'genre:"j-rock"',
  'genre:"j-rap"',
  'genre:"j-idol"',
  'genre:"japanese indie"',
  'genre:"japanese indie rock"',
  'genre:"japanese r&b"',
  'genre:"japanese soul"',
  'genre:"japanese electronic"',
  'genre:"japanese alternative rock"',
  'genre:"japanese indie pop"',
  'genre:"japanese punk"',
  'genre:"japanese garage rock"',
  'genre:"shibuya-kei"',
  'genre:"city pop"',
  'genre:"japanese jazz"',
  'genre:"japanese folk"',
  'genre:"vocaloid"',
  'genre:"anison"',
  'genre:"j-pop boy group"',
  'genre:"j-pop girl group"',
  'genre:"japanese teen pop"',
  'genre:"japanese hip hop"',
  'genre:"japanese trap"',
  'genre:"japanese ambient"',
  'genre:"japanese post-rock"',
  'genre:"japanese shoegaze"',
  'genre:"japanese hardcore"',
  'genre:"japanese metal"',
  'genre:"visual kei"',
  // 年代別 J-POP
  "japanese pop 1970",
  "japanese pop 1980",
  "japanese pop 1985",
  "japanese pop 1990",
  "japanese pop 1995",
  "japanese pop 2000",
  "japanese pop 2005",
  "japanese pop 2010",
  "japanese pop 2015",
  "japanese pop 2020",
  // キーワード
  "Japan band",
  "Tokyo band",
  "Osaka band",
  "Okinawa music",
  "Hokkaido band",
  "anime opening",
  "anime ending",
  "VTuber music",
  "Japanese singer",
  "Japanese rapper",
  "Japanese guitarist",
  "Japanese pianist",
  "Japanese DJ",
  // 日本語クエリ
  "Jポップ",
  "Jロック",
  "アニメソング",
  "シティポップ",
  "渋谷系",
  "ボカロP",
  "歌い手",
  "邦楽",
];

type ArtistHit = {
  id: string;
  name: string;
  /** 上位ほど検索ランキング上位なので priority に使う */
  rank: number;
};

async function spotifyToken(): Promise<string> {
  const id = process.env.SPOTIFY_CLIENT_ID;
  const sec = process.env.SPOTIFY_CLIENT_SECRET;
  if (!id || !sec) throw new Error("SPOTIFY_CLIENT_ID / SECRET 未設定");

  const cred = Buffer.from(`${id}:${sec}`).toString("base64");
  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${cred}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  if (!res.ok) throw new Error(`token error ${res.status}`);
  return (await res.json()).access_token;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function searchArtists(
  token: string,
  query: string,
  limit = 10,
  offset = 0,
): Promise<{ artists: ArtistHit[]; nextOffset: number | null }> {
  const url = new URL("https://api.spotify.com/v1/search");
  url.searchParams.set("q", query);
  url.searchParams.set("type", "artist");
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("offset", String(offset));
  url.searchParams.set("market", "JP");

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (res.status === 429) {
      const retry = Number(res.headers.get("Retry-After") ?? "5");
      const waitSec = Math.min(retry || 5, 120);
      console.warn(`   ⏸️ 429 — ${waitSec}s 待機`);
      await sleep(waitSec * 1000 + 500);
      continue;
    }

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`search ${res.status}: ${body.slice(0, 200)}`);
    }

    const json = (await res.json()) as {
      artists: {
        items: {
          id: string;
          name: string;
        }[];
        next: string | null;
        offset: number;
        limit: number;
      };
    };

    const artists: ArtistHit[] = json.artists.items.map((a, i) => ({
      id: a.id,
      name: a.name,
      rank: offset + i,
    }));

    const nextOffset = json.artists.next
      ? json.artists.offset + json.artists.limit
      : null;

    return { artists, nextOffset };
  }

  throw new Error("429 リトライ上限");
}

async function main() {
  loadEnvLocal();

  const target = parseFlag("target", 500);
  // limit=10 がキャップなので、1 クエリで最大 (pages × 10) 件
  const perQueryPages = parseFlag("pages", 8);

  console.log(`🎯 目標: 合計 ${target} 組 (DB + キュー)`);
  console.log(`   クエリ毎の取得ページ数: ${perQueryPages} (各 10 件)`);

  const { createAdminClient } = await import("../lib/supabase/admin");
  const supabase = createAdminClient();

  const { data: existingArtists } = await supabase
    .from("artists")
    .select("spotify_id, name");
  const { data: existingQueue } = await supabase
    .from("artist_sync_queue")
    .select("spotify_id, name, status");

  const knownIds = new Set<string>();
  const knownNames = new Set<string>();

  for (const a of existingArtists ?? []) {
    if (a.spotify_id) knownIds.add(a.spotify_id);
    if (a.name) knownNames.add(a.name.toLowerCase());
  }
  for (const q of existingQueue ?? []) {
    if (q.spotify_id) knownIds.add(q.spotify_id);
    if (q.name) knownNames.add(q.name.toLowerCase());
  }

  const dbCount = existingArtists?.length ?? 0;
  const queueCount =
    (existingQueue ?? []).filter(
      (r) => r.status === "pending" || r.status === "syncing",
    ).length;
  const currentTotal = dbCount + queueCount;

  console.log(`   現状: DB ${dbCount} 組 + キュー ${queueCount} 組 = ${currentTotal} 組`);

  let needed = target - currentTotal;
  if (needed <= 0) {
    console.log(`✅ 既に目標達成`);
    return;
  }

  console.log(`   追加が必要: ${needed} 組`);
  console.log("");

  const token = await spotifyToken();
  const discovered = new Map<string, ArtistHit>();
  let queriesUsed = 0;

  for (const query of DISCOVERY_QUERIES) {
    queriesUsed += 1;
    let added = 0;

    for (let page = 0; page < perQueryPages; page += 1) {
      const offset = page * 10;
      try {
        const { artists, nextOffset } = await searchArtists(
          token,
          query,
          10,
          offset,
        );

        for (const a of artists) {
          if (knownIds.has(a.id)) continue;
          if (knownNames.has(a.name.toLowerCase())) continue;
          if (discovered.has(a.id)) continue;

          discovered.set(a.id, a);
          added += 1;
        }

        if (nextOffset === null) break;
        if (artists.length === 0) break;
      } catch (err) {
        console.warn(`   ⚠️ "${query}" page ${page}: ${err instanceof Error ? err.message : err}`);
        break;
      }
      await sleep(800);
    }

    console.log(`[${queriesUsed}/${DISCOVERY_QUERIES.length}] "${query}" → +${added} (累計 ${discovered.size})`);

    if (discovered.size >= needed) break;
  }

  console.log("");
  console.log(`📦 発見: ${discovered.size} 組`);

  if (discovered.size === 0) {
    console.log("追加するアーティストがありませんでした");
    return;
  }

  // 検索ランキング上位（rank 小）を優先
  const sorted = Array.from(discovered.values()).sort((a, b) => a.rank - b.rank);
  const toEnqueue = sorted.slice(0, needed);

  console.log(`📥 キューに ${toEnqueue.length} 組を追加中…`);

  const { enqueueArtists } = await import("../lib/spotify/queue");
  const result = await enqueueArtists(
    supabase,
    toEnqueue.map((a, i) => ({
      name: a.name,
      spotify_id: a.id,
      priority: Math.max(0, 100 - Math.floor(i / 10)),
    })),
  );

  console.log(
    `✅ 完了: 追加 ${result.added} / 更新 ${result.updated} / スキップ ${result.skipped}`,
  );
}

main().catch((err) => {
  console.error("❌", err);
  process.exit(1);
});
