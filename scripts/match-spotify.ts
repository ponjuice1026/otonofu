/**
 * albums のうち spotify_id が null の行を Spotify 検索で照合し、
 * spotify_id と cover_url を補完する。
 *
 * 誤マッチ（別アルバムのジャケットが付いてしまう事故）を避けることを最優先にしており、
 * 既定では DRY RUN（DB 変更なし）で走り、--apply を明示した時だけ書き込む。
 * スコアリングの実体は lib/spotify/match.ts の純関数（アーティスト不一致は
 * 問答無用でスコア 0、タイトル類似度が低すぎても不採用）。
 *
 * 実行（あなたのPCで。tsx が必要）:
 *   npm run match:spotify                          … DRY RUN（既定）。レポートのみ、DB変更なし
 *   npx tsx scripts/match-spotify.ts --apply        … 高信頼マッチのみ実際に albums を更新
 *   npx tsx scripts/match-spotify.ts --limit=200     … 先頭200件だけ処理
 *   npx tsx scripts/match-spotify.ts --delay=600     … Spotify API 呼び出し間隔(ms)。既定400
 *   npx tsx scripts/match-spotify.ts --min-score=0.9 … 高信頼判定の閾値を引き上げ（より保守的に）
 *
 * .env.local に NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY /
 * SPOTIFY_CLIENT_ID / SPOTIFY_CLIENT_SECRET が必要。
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { createAdminClient } from "../lib/supabase/admin";
import { searchSpotify } from "../lib/spotify/api";
import {
  pickBestMatch,
  isHighConfidence,
  DEFAULT_MIN_SCORE,
  type MatchAlbumRow,
  type MatchCandidate,
} from "../lib/spotify/match";
import type { SpotifyAlbum } from "../lib/spotify/types";

function loadEnvLocal() {
  const envPath = resolve(process.cwd(), ".env.local");
  if (!existsSync(envPath)) return;

  const content = readFileSync(envPath, "utf8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
    if (!process.env[key]) process.env[key] = value;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function argValue(name: string, fallback: string): string {
  const found = process.argv.find((a) => a.startsWith(`--${name}=`));
  return found ? found.split("=").slice(1).join("=") : fallback;
}

type AlbumRow = {
  id: string;
  title: string;
  artist_id: string;
  year: number | null;
};
type ArtistRow = {
  id: string;
  name: string;
  name_en: string | null;
};

async function fetchAll<T>(
  fp: (
    from: number,
    to: number,
  ) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
): Promise<T[]> {
  const out: T[] = [];
  for (let page = 0; ; page += 1) {
    const from = page * 1000;
    const { data, error } = await fp(from, from + 999);
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) break;
    out.push(...data);
    if (data.length < 1000) break;
  }
  return out;
}

function toCandidate(album: SpotifyAlbum): MatchCandidate {
  return {
    id: album.id,
    name: album.name,
    releaseDate: album.release_date,
    artists: album.artists.map((a) => ({ id: a.id, name: a.name })),
    images: album.images,
  };
}

/** Spotify 検索。429 等は searchSpotify 内部（spotifyFetch）で自動リトライ済み。
 * それ以外の失敗（ネットワークエラー等）は 1 回だけ簡易リトライしてから諦める。 */
async function safeSearch(query: string): Promise<SpotifyAlbum[]> {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const res = await searchSpotify(query, "album", 10);
      return res.albums?.items ?? [];
    } catch (e) {
      if (attempt === 1) {
        console.warn(
          `  ⚠ 検索失敗（スキップ）: "${query}" — ${e instanceof Error ? e.message : e}`,
        );
        return [];
      }
      await sleep(1000);
    }
  }
  return [];
}

type Outcome =
  | { kind: "high"; albumId: string; dbTitle: string; candidateName: string; score: number; spotifyId: string; coverUrl: string | null }
  | { kind: "low"; albumId: string; dbTitle: string; candidateName: string; score: number }
  | { kind: "none"; albumId: string; dbTitle: string };

async function main() {
  loadEnvLocal();

  const apply = process.argv.includes("--apply");
  const dryRun = !apply; // --apply を明示しない限り常に DRY RUN
  const limit = Number(argValue("limit", "0"));
  const delayMs = Number(argValue("delay", "400"));
  const minScore = Number(argValue("min-score", String(DEFAULT_MIN_SCORE)));

  if (!Number.isFinite(minScore) || minScore <= 0 || minScore > 1) {
    console.error(`--min-score は 0 より大きく 1 以下で指定してください（指定値: ${argValue("min-score", "")}）`);
    process.exit(1);
  }

  const sb = createAdminClient();

  console.log(`モード: ${dryRun ? "DRY RUN（DB変更なし）" : "APPLY（高信頼マッチのみ書き込み）"}`);
  console.log(`min-score: ${minScore} / limit: ${limit || "無制限"} / delay: ${delayMs}ms\n`);

  const allTargets = await fetchAll<AlbumRow>((from, to) =>
    sb
      .from("albums")
      .select("id, title, artist_id, year")
      .is("spotify_id", null)
      .range(from, to),
  );

  const artists = await fetchAll<ArtistRow>((from, to) =>
    sb.from("artists").select("id, name, name_en").range(from, to),
  );
  const artistById = new Map(artists.map((a) => [a.id, a]));

  const targets = limit > 0 ? allTargets.slice(0, limit) : allTargets;
  console.log(`対象（spotify_id が null）: ${allTargets.length} 件中 ${targets.length} 件を処理します\n`);

  let highCount = 0;
  let lowCount = 0;
  let noneCount = 0;
  let failedCount = 0;
  let appliedCount = 0;
  let applyFailedCount = 0;

  const lowConfidenceSamples: { dbTitle: string; candidateName: string; score: number }[] = [];
  const noneSamples: string[] = [];

  for (let i = 0; i < targets.length; i += 1) {
    const album = targets[i];
    const artist = artistById.get(album.artist_id);

    if (!artist) {
      console.warn(`  ⚠ artist_id 未解決（スキップ）: album=${album.id} (${album.title})`);
      noneCount += 1;
      noneSamples.push(`${album.title} [artist_id 不明]`);
      continue;
    }

    const matchAlbum: MatchAlbumRow = {
      id: album.id,
      title: album.title,
      artistName: artist.name,
      artistNameEn: artist.name_en,
      year: album.year,
    };

    let items: SpotifyAlbum[] = [];
    try {
      items = await safeSearch(`${artist.name} ${album.title}`);
      // name_en があり、かつ十分な結果が得られなかった場合は追加で試す
      if (items.length === 0 && artist.name_en && artist.name_en !== artist.name) {
        items = await safeSearch(`${artist.name_en} ${album.title}`);
      }
    } catch (e) {
      console.warn(`  ⚠ 予期しない検索エラー（スキップ）: ${album.title} — ${e instanceof Error ? e.message : e}`);
      failedCount += 1;
      await sleep(delayMs);
      continue;
    }

    if (items.length === 0) {
      noneCount += 1;
      noneSamples.push(`${artist.name} / ${album.title}`);
      await sleep(delayMs);
      continue;
    }

    const candidates = items.map(toCandidate);
    const best = pickBestMatch(matchAlbum, candidates);

    if (!best) {
      noneCount += 1;
      noneSamples.push(`${artist.name} / ${album.title}（候補あり・スコア不足）`);
      await sleep(delayMs);
      continue;
    }

    const high = isHighConfidence(best.detail.score, minScore);

    if (high) {
      highCount += 1;
      const coverUrl = best.candidate.images?.[0]?.url ?? null;

      if (apply) {
        const { error } = await sb
          .from("albums")
          .update({
            spotify_id: best.candidate.id,
            ...(coverUrl ? { cover_url: coverUrl } : {}),
          })
          .eq("id", album.id);

        if (error) {
          applyFailedCount += 1;
          console.warn(`  ⚠ 更新失敗: ${album.title} — ${error.message}`);
        } else {
          appliedCount += 1;
        }
      }
    } else {
      lowCount += 1;
      if (lowConfidenceSamples.length < 30) {
        lowConfidenceSamples.push({
          dbTitle: `${artist.name} / ${album.title}`,
          candidateName: `${best.candidate.name} [${best.candidate.artists.map((a) => a.name).join(", ")}]`,
          score: best.detail.score,
        });
      }
    }

    if ((i + 1) % 100 === 0 || i + 1 === targets.length) {
      console.log(
        `  進捗 ${i + 1}/${targets.length}（高信頼 ${highCount} / 低信頼 ${lowCount} / マッチ無し ${noneCount} / 失敗 ${failedCount}）`,
      );
    }

    await sleep(delayMs);
  }

  console.log(`\n──────── 集計 ────────`);
  console.log(`処理件数: ${targets.length}`);
  console.log(`高信頼マッチ（score >= ${minScore}）: ${highCount} 件`);
  console.log(`低信頼（未適用・要目視）: ${lowCount} 件`);
  console.log(`マッチ無し: ${noneCount} 件`);
  console.log(`検索失敗: ${failedCount} 件`);

  if (apply) {
    console.log(`\n適用（albums 更新）: ${appliedCount} 件`);
    if (applyFailedCount > 0) console.log(`更新失敗: ${applyFailedCount} 件`);
  } else {
    console.log(`\n(DRY RUN のため DB は一切変更していません。--apply で高信頼マッチのみ書き込みます)`);
  }

  if (lowConfidenceSamples.length > 0) {
    console.log(`\n── 低信頼サンプル（先頭${lowConfidenceSamples.length}件・未適用） ──`);
    for (const s of lowConfidenceSamples) {
      console.log(`  "${s.dbTitle}" → "${s.candidateName}"  score=${s.score.toFixed(3)}`);
    }
  }

  if (noneSamples.length > 0) {
    console.log(`\n── マッチ無しサンプル（先頭10件） ──`);
    for (const s of noneSamples.slice(0, 10)) {
      console.log(`  ${s}`);
    }
  }
}

main().catch((e) => {
  console.error("\n❌ エラー:", e instanceof Error ? e.message : e);
  process.exit(1);
});
