import { backfillAlbumTracksBatch, countAlbumsMissingTracks } from "@/lib/spotify/backfill-tracks";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSpotifyConfigured } from "@/lib/spotify/env";
import {
  enqueueArtists,
  getQueueStats,
  recoverStuckQueueRows,
} from "@/lib/spotify/queue";
import { runSpotifyQueueSync } from "@/lib/spotify/run-sync";
import { loadArtistSeeds } from "@/lib/spotify/seeds";
import { SPOTIFY_SEED_IDS } from "@/lib/spotify/sync";

export type SyncDaemonOptions = {
  artistBatchSize?: number;
  trackBatchSize?: number;
  artistDelayMs?: number;
  trackDelayMs?: number;
  cycleSleepMs?: number;
  idleSleepMs?: number;
  rateLimitSleepMs?: number;
  requeueFailed?: boolean;
};

export type SyncDaemonCycleResult = {
  artistsSynced: number;
  albumsSynced: number;
  tracksFilled: number;
  rateLimited: boolean;
  idle: boolean;
  queuePending: number;
  tracksRemaining: number;
};

function envNumber(key: string, fallback: number): number {
  const value = Number(process.env[key]);
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}

export function applySyncDaemonDefaults(): void {
  if (!process.env.SPOTIFY_REQUEST_INTERVAL_MS) {
    process.env.SPOTIFY_REQUEST_INTERVAL_MS = "1200";
  }
  if (!process.env.SPOTIFY_SYNC_DELAY_MS) {
    process.env.SPOTIFY_SYNC_DELAY_MS = "8000";
  }
  if (!process.env.SPOTIFY_SYNC_BATCH_SIZE) {
    process.env.SPOTIFY_SYNC_BATCH_SIZE = "1";
  }
}

function resolveOptions(options: SyncDaemonOptions = {}) {
  return {
    artistBatchSize:
      options.artistBatchSize ??
      envNumber("SPOTIFY_DAEMON_ARTIST_BATCH", 1),
    trackBatchSize:
      options.trackBatchSize ?? envNumber("SPOTIFY_DAEMON_TRACK_BATCH", 2),
    artistDelayMs:
      options.artistDelayMs ?? envNumber("SPOTIFY_SYNC_DELAY_MS", 8000),
    trackDelayMs:
      options.trackDelayMs ?? envNumber("SPOTIFY_DAEMON_TRACK_DELAY_MS", 2500),
    cycleSleepMs:
      options.cycleSleepMs ??
      envNumber("SPOTIFY_DAEMON_CYCLE_SLEEP_MS", 15000),
    idleSleepMs:
      options.idleSleepMs ??
      envNumber("SPOTIFY_DAEMON_IDLE_SLEEP_MS", 120000),
    rateLimitSleepMs:
      options.rateLimitSleepMs ??
      envNumber("SPOTIFY_DAEMON_RATE_LIMIT_SLEEP_MS", 300000),
    requeueFailed: options.requeueFailed ?? true,
  };
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function ensureQueueHasWork(requeueFailed: boolean): Promise<number> {
  const supabase = createAdminClient();
  const stats = await getQueueStats(supabase);

  if (requeueFailed && stats.failed > 0) {
    const { data } = await supabase
      .from("artist_sync_queue")
      .update({
        status: "pending",
        updated_at: new Date().toISOString(),
      })
      .eq("status", "failed")
      .lt("attempts", 5)
      .select("id");

    if ((data?.length ?? 0) > 0) {
      console.log(`↩️ failed ${data?.length ?? 0} 件を pending に戻しました`);
    }
  }

  const pending = stats.pending + stats.failed;
  if (pending > 0) return pending;

  const seeds = loadArtistSeeds();
  const entries = seeds.map((name) => ({
    name,
    spotify_id: SPOTIFY_SEED_IDS[name] ?? null,
  }));

  const result = await enqueueArtists(supabase, entries, { requeueDone: false });
  if (result.added > 0 || result.updated > 0) {
    console.log(
      `📥 キュー補充: 追加 ${result.added} / 更新 ${result.updated} / スキップ ${result.skipped}`,
    );
  }

  return await getQueueStats(supabase).then(
    (s) => s.pending + s.failed,
  );
}

export async function runSyncDaemonCycle(
  options: SyncDaemonOptions = {},
): Promise<SyncDaemonCycleResult> {
  if (!isSpotifyConfigured()) {
    throw new Error("Spotify が未設定です。");
  }

  const opts = resolveOptions(options);
  const supabase = createAdminClient();

  await recoverStuckQueueRows(supabase);
  await ensureQueueHasWork(opts.requeueFailed);

  let artistsSynced = 0;
  let albumsSynced = 0;
  let tracksFilled = 0;
  let rateLimited = false;

  const queueResult = await runSpotifyQueueSync({
    batchSize: opts.artistBatchSize,
    delayMs: opts.artistDelayMs,
  });

  artistsSynced = queueResult.artistCount;
  albumsSynced = queueResult.albumCount;
  rateLimited = Boolean(queueResult.rateLimited);

  if (queueResult.processed.length > 0) {
    console.log(
      `🎤 アーティスト同期: ${queueResult.processed.join(", ")}（${albumsSynced} アルバム）`,
    );
  }

  if (!rateLimited && opts.trackBatchSize > 0) {
    const trackResult = await backfillAlbumTracksBatch(
      opts.trackBatchSize,
      opts.trackDelayMs,
    );
    tracksFilled = trackResult.success;
    rateLimited = rateLimited || trackResult.rateLimited;

    for (const line of trackResult.processed) {
      console.log(`  🎵 ${line}`);
    }
  }

  const queuePending = queueResult.queue?.pending ?? 0;
  const tracksRemaining = await countAlbumsMissingTracks();
  const idle =
    artistsSynced === 0 &&
    tracksFilled === 0 &&
    !rateLimited &&
    queuePending === 0 &&
    tracksRemaining === 0;

  return {
    artistsSynced,
    albumsSynced,
    tracksFilled,
    rateLimited,
    idle,
    queuePending,
    tracksRemaining,
  };
}

export async function runSyncDaemonLoop(
  options: SyncDaemonOptions = {},
): Promise<never> {
  applySyncDaemonDefaults();
  const opts = resolveOptions(options);

  console.log("🔄 Spotify 同期デーモン開始（Ctrl+C で停止）");
  console.log(
    `   設定: アーティスト ${opts.artistBatchSize} 件/周 · 曲 ${opts.trackBatchSize} 件/周 · API間隔 ${process.env.SPOTIFY_REQUEST_INTERVAL_MS}ms`,
  );

  let cycle = 0;

  while (true) {
    cycle += 1;
    const started = Date.now();

    try {
      const result = await runSyncDaemonCycle(options);

      console.log(
        `📊 [${cycle}] pending ${result.queuePending} · 曲未登録 ${result.tracksRemaining} · +${result.artistsSynced} アーティスト · +${result.tracksFilled} 曲`,
      );

      if (result.rateLimited) {
        const waitMin = Math.round(opts.rateLimitSleepMs / 60000);
        console.warn(`⏸️ Spotify 429 — ${waitMin} 分待機します…`);
        await sleep(opts.rateLimitSleepMs);
        continue;
      }

      if (result.idle) {
        console.log(
          `💤 キュー・曲バックフィルともに完了。${Math.round(opts.idleSleepMs / 1000)} 秒待機…`,
        );
        await sleep(opts.idleSleepMs);
        continue;
      }

      const elapsed = Date.now() - started;
      const rest = Math.max(opts.cycleSleepMs - elapsed, 0);
      if (rest > 0) {
        await sleep(rest);
      }
    } catch (err) {
      console.error(
        `❌ [${cycle}] ${err instanceof Error ? err.message : err}`,
      );
      await sleep(opts.rateLimitSleepMs);
    }
  }
}
