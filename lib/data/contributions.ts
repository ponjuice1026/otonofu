import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import {
  CONTRIBUTION_KIND_LABELS,
  CONTRIBUTION_PAYLOAD_LABELS,
} from "@/lib/contributions/constants";
import type {
  DbContributionRequest,
  DbProfile,
} from "@/lib/supabase/types";
import type { ContributionRequest } from "@/lib/types";

function mapContribution(row: DbContributionRequest): ContributionRequest {
  return {
    id: row.id,
    requesterId: row.requester_id,
    kind: row.kind,
    targetArtistId: row.target_artist_id,
    targetAlbumId: row.target_album_id,
    payload: row.payload ?? {},
    status: row.status,
    adminNote: row.admin_note,
    createdAt: row.created_at,
    resolvedAt: row.resolved_at,
  };
}

/** 申請者本人の申請一覧（/profile 表示用）。RLS により自分の分のみ返る。 */
export async function getMyContributions(
  userId: string,
): Promise<ContributionRequest[]> {
  if (!isSupabaseConfigured()) return [];

  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("contribution_requests")
      .select("*")
      .eq("requester_id", userId)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error || !data) {
      console.error("[Supabase] getMyContributions:", error?.message);
      return [];
    }

    return (data as DbContributionRequest[]).map(mapContribution);
  } catch (err) {
    console.error("[Supabase] getMyContributions:", err);
    return [];
  }
}

export type AdminContributionRow = {
  id: string;
  kind: ContributionRequest["kind"];
  kindLabel: string;
  requesterName: string;
  /** payload を「ラベル: 値」の配列に整形したもの（表示用） */
  fields: { label: string; value: string }[];
  targetArtistId: string | null;
  targetAlbumId: string | null;
  /** fix 時の修正対象へのリンク（artists/albums）。無ければ null */
  targetHref: string | null;
  targetLabel: string | null;
  createdAt: string;
};

function payloadToFields(
  payload: Record<string, unknown>,
): { label: string; value: string }[] {
  const fields: { label: string; value: string }[] = [];
  for (const [key, raw] of Object.entries(payload)) {
    if (raw === null || raw === undefined || raw === "") continue;
    const value = typeof raw === "string" ? raw : JSON.stringify(raw);
    if (!value.trim()) continue;
    fields.push({
      label: CONTRIBUTION_PAYLOAD_LABELS[key] ?? key,
      value,
    });
  }
  return fields;
}

/**
 * 管理画面の未処理申請一覧。RLS の admin ポリシーにより全件取得可。
 * 申請者名・修正対象（アーティスト/アルバム名）を解決する。
 */
export async function getPendingContributions(
  limit = 50,
): Promise<AdminContributionRow[]> {
  if (!isSupabaseConfigured()) return [];

  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("contribution_requests")
      .select("*")
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error || !data) {
      console.error("[Supabase] getPendingContributions:", error?.message);
      return [];
    }

    const rows = data as DbContributionRequest[];
    if (rows.length === 0) return [];

    // 申請者名の解決
    const requesterIds = [...new Set(rows.map((r) => r.requester_id))];
    const requesterNames = new Map<string, string>();
    if (requesterIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, username, display_name")
        .in("id", requesterIds);
      for (const p of (profiles ?? []) as DbProfile[]) {
        requesterNames.set(p.id, p.display_name?.trim() || p.username);
      }
    }

    // 修正対象（アーティスト/アルバム）名の解決
    const artistIds = [
      ...new Set(rows.map((r) => r.target_artist_id).filter((v): v is string => Boolean(v))),
    ];
    const albumIds = [
      ...new Set(rows.map((r) => r.target_album_id).filter((v): v is string => Boolean(v))),
    ];
    const artistNames = new Map<string, string>();
    const albumTitles = new Map<string, string>();

    if (artistIds.length > 0) {
      const { data: artists } = await supabase
        .from("artists")
        .select("id, name")
        .in("id", artistIds);
      for (const a of (artists ?? []) as { id: string; name: string }[]) {
        artistNames.set(a.id, a.name);
      }
    }
    if (albumIds.length > 0) {
      const { data: albums } = await supabase
        .from("albums")
        .select("id, title")
        .in("id", albumIds);
      for (const a of (albums ?? []) as { id: string; title: string }[]) {
        albumTitles.set(a.id, a.title);
      }
    }

    return rows.map((row) => {
      let targetHref: string | null = null;
      let targetLabel: string | null = null;
      if (row.target_album_id) {
        targetHref = `/albums/${row.target_album_id}`;
        targetLabel = albumTitles.get(row.target_album_id) ?? row.target_album_id;
      } else if (row.target_artist_id) {
        targetHref = `/artists/${row.target_artist_id}`;
        targetLabel =
          artistNames.get(row.target_artist_id) ?? row.target_artist_id;
      }

      return {
        id: row.id,
        kind: row.kind,
        kindLabel: CONTRIBUTION_KIND_LABELS[row.kind],
        requesterName: requesterNames.get(row.requester_id) ?? "ユーザー",
        fields: payloadToFields(row.payload ?? {}),
        targetArtistId: row.target_artist_id,
        targetAlbumId: row.target_album_id,
        targetHref,
        targetLabel,
        createdAt: row.created_at,
      };
    });
  } catch (err) {
    console.error("[Supabase] getPendingContributions:", err);
    return [];
  }
}

/** 未処理申請の件数（管理画面の統計カード用） */
export async function getPendingContributionCount(): Promise<number> {
  if (!isSupabaseConfigured()) return 0;

  try {
    const supabase = await createClient();
    const { count, error } = await supabase
      .from("contribution_requests")
      .select("*", { count: "exact", head: true })
      .eq("status", "pending");

    if (error) {
      console.error("[Supabase] getPendingContributionCount:", error.message);
      return 0;
    }
    return count ?? 0;
  } catch (err) {
    console.error("[Supabase] getPendingContributionCount:", err);
    return 0;
  }
}
