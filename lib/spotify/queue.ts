import type { createAdminClient } from "@/lib/supabase/admin";

export type QueueStatus =
  | "pending"
  | "syncing"
  | "failed"
  | "done"
  | "skipped";

export type QueueRow = {
  id: string;
  name: string;
  spotify_id: string | null;
  status: QueueStatus;
  priority: number;
  attempts: number;
  last_error: string | null;
  created_at: string;
  updated_at: string;
  synced_at: string | null;
};

export type EnqueueInput = {
  name: string;
  spotify_id?: string | null;
  priority?: number;
};

export type QueueStats = {
  pending: number;
  syncing: number;
  failed: number;
  done: number;
  skipped: number;
  total: number;
};

type AdminClient = ReturnType<typeof createAdminClient>;

export async function getQueueStats(
  supabase: AdminClient,
): Promise<QueueStats> {
  const { data, error } = await supabase
    .from("artist_sync_queue")
    .select("status");

  if (error) {
    throw new Error(`キュー統計の取得に失敗: ${error.message}`);
  }

  const stats: QueueStats = {
    pending: 0,
    syncing: 0,
    failed: 0,
    done: 0,
    skipped: 0,
    total: 0,
  };

  for (const row of data ?? []) {
    const status = row.status as QueueStatus;
    stats[status] += 1;
    stats.total += 1;
  }

  return stats;
}

export async function enqueueArtists(
  supabase: AdminClient,
  entries: EnqueueInput[],
  options: { requeueDone?: boolean } = {},
): Promise<{ added: number; updated: number; skipped: number }> {
  let added = 0;
  let updated = 0;
  let skipped = 0;

  for (const entry of entries) {
    const name = entry.name.trim();
    if (!name) continue;

    const spotifyId = entry.spotify_id?.trim() || null;
    const priority = entry.priority ?? 0;

    let existing: Pick<
      QueueRow,
      "id" | "status" | "spotify_id" | "priority"
    > | null = null;

    if (spotifyId) {
      const { data } = await supabase
        .from("artist_sync_queue")
        .select("id, status, spotify_id, priority")
        .eq("spotify_id", spotifyId)
        .maybeSingle();
      existing = data;
    }

    if (!existing) {
      const { data } = await supabase
        .from("artist_sync_queue")
        .select("id, status, spotify_id, priority")
        .eq("name", name)
        .maybeSingle();
      existing = data;
    }

    if (existing) {
      if (existing.status === "done" && !options.requeueDone) {
        skipped += 1;
        continue;
      }

      const patch: Partial<QueueRow> = {
        updated_at: new Date().toISOString(),
      };

      if (spotifyId && !existing.spotify_id) {
        patch.spotify_id = spotifyId;
      }
      if (priority > existing.priority) {
        patch.priority = priority;
      }
      if (
        options.requeueDone ||
        existing.status === "failed" ||
        existing.status === "skipped"
      ) {
        patch.status = "pending";
        patch.last_error = null;
      }

      if (Object.keys(patch).length > 1) {
        const { error } = await supabase
          .from("artist_sync_queue")
          .update(patch)
          .eq("id", existing.id);
        if (error) throw new Error(error.message);
        updated += 1;
      } else {
        skipped += 1;
      }
      continue;
    }

    const { error } = await supabase.from("artist_sync_queue").insert({
      name,
      spotify_id: spotifyId,
      priority,
      status: "pending",
    });

    if (error) {
      if (error.code === "23505") {
        skipped += 1;
        continue;
      }
      throw new Error(error.message);
    }

    added += 1;
  }

  return { added, updated, skipped };
}

export async function fetchQueueBatch(
  supabase: AdminClient,
  batchSize: number,
  maxAttempts: number,
): Promise<QueueRow[]> {
  const { data, error } = await supabase
    .from("artist_sync_queue")
    .select("*")
    .in("status", ["pending", "failed"])
    .lt("attempts", maxAttempts)
    .order("priority", { ascending: false })
    .order("created_at", { ascending: true })
    .limit(batchSize);

  if (error) {
    throw new Error(`キュー取得に失敗: ${error.message}`);
  }

  return (data ?? []) as QueueRow[];
}

/** 前回中断で syncing のまま残った行を pending に戻す */
export async function recoverStuckQueueRows(
  supabase: AdminClient,
): Promise<number> {
  const { data, error } = await supabase
    .from("artist_sync_queue")
    .update({
      status: "pending",
      updated_at: new Date().toISOString(),
    })
    .eq("status", "syncing")
    .select("id");

  if (error) throw new Error(error.message);
  return data?.length ?? 0;
}

export async function markQueueSyncing(
  supabase: AdminClient,
  id: string,
): Promise<void> {
  const { error } = await supabase
    .from("artist_sync_queue")
    .update({
      status: "syncing",
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) throw new Error(error.message);
}

export async function releaseQueueRow(
  supabase: AdminClient,
  id: string,
): Promise<void> {
  const { error } = await supabase
    .from("artist_sync_queue")
    .update({
      status: "pending",
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) throw new Error(error.message);
}

/** @deprecated fetchQueueBatch + markQueueSyncing を使用 */
export async function claimQueueBatch(
  supabase: AdminClient,
  batchSize: number,
  maxAttempts: number,
): Promise<QueueRow[]> {
  const batch = await fetchQueueBatch(supabase, batchSize, maxAttempts);
  for (const row of batch) {
    await markQueueSyncing(supabase, row.id);
  }
  return batch.map((row) => ({ ...row, status: "syncing" as const }));
}

export async function markQueueDone(
  supabase: AdminClient,
  id: string,
  attempts: number,
): Promise<void> {
  const { error } = await supabase
    .from("artist_sync_queue")
    .update({
      status: "done",
      attempts: attempts + 1,
      last_error: null,
      synced_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) throw new Error(error.message);
}

export async function markQueueFailed(
  supabase: AdminClient,
  id: string,
  attempts: number,
  message: string,
): Promise<void> {
  const { error } = await supabase
    .from("artist_sync_queue")
    .update({
      status: "failed",
      attempts: attempts + 1,
      last_error: message.slice(0, 500),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) throw new Error(error.message);
}

export async function markQueueSkipped(
  supabase: AdminClient,
  id: string,
  attempts: number,
  message: string,
): Promise<void> {
  const { error } = await supabase
    .from("artist_sync_queue")
    .update({
      status: "skipped",
      attempts: attempts + 1,
      last_error: message.slice(0, 500),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) throw new Error(error.message);
}

export async function countQueuePending(
  supabase: AdminClient,
  maxAttempts: number,
): Promise<number> {
  const { count, error } = await supabase
    .from("artist_sync_queue")
    .select("*", { count: "exact", head: true })
    .in("status", ["pending", "failed"])
    .lt("attempts", maxAttempts);

  if (error) throw new Error(error.message);
  return count ?? 0;
}
