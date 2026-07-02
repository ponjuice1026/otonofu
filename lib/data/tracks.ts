import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import type { Album, AlbumTrack } from "@/lib/types";

export async function saveAlbumTracks(
  albumId: string,
  tracks: AlbumTrack[],
): Promise<void> {
  if (!isSupabaseConfigured() || tracks.length === 0) return;

  try {
    const admin = createAdminClient();
    await admin.from("albums").update({ tracks }).eq("id", albumId);
  } catch {
    // service role 未設定時はスキップ
  }
}

/** ページ表示用: DB のみ（Spotify API は呼ばない） */
export function getAlbumTracksFromDb(album: Album): AlbumTrack[] {
  return album.tracks ?? [];
}
