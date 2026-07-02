import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { getVoterKey } from "@/lib/threads/voter";
import type {
  DbDiscussionPollOption,
  DbDiscussionPollVote,
} from "@/lib/supabase/types";
import type {
  DiscussionPoll,
  DiscussionPollOption,
  PollOptionAlbumRef,
  PollOptionArtistRef,
} from "@/lib/types";

export async function threadHasPoll(threadId: string): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;

  const supabase = await createClient();
  const { count, error } = await supabase
    .from("discussion_poll_options")
    .select("*", { count: "exact", head: true })
    .eq("thread_id", threadId);

  if (error) return false;
  return (count ?? 0) > 0;
}

export async function getPollOptionCounts(
  threadId: string,
): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  if (!isSupabaseConfigured()) return counts;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("discussion_poll_votes")
    .select("option_id")
    .eq("thread_id", threadId);

  if (error || !data) return counts;

  for (const row of data as Pick<DbDiscussionPollVote, "option_id">[]) {
    counts.set(row.option_id, (counts.get(row.option_id) ?? 0) + 1);
  }

  return counts;
}

type AlbumLookupRow = {
  id: string;
  title: string;
  artist_id: string;
  year: number | null;
  cover_url: string | null;
  spotify_id: string | null;
};

type ArtistLookupRow = {
  id: string;
  name: string;
  image_url: string | null;
  spotify_id: string | null;
};

async function loadAlbumRefs(
  supabase: Awaited<ReturnType<typeof createClient>>,
  albumIds: string[],
): Promise<Map<string, PollOptionAlbumRef>> {
  const map = new Map<string, PollOptionAlbumRef>();
  if (albumIds.length === 0) return map;

  const { data: albums } = await supabase
    .from("albums")
    .select("id, title, artist_id, year, cover_url, spotify_id")
    .in("id", albumIds);

  const rows = (albums ?? []) as AlbumLookupRow[];
  const artistIds = [...new Set(rows.map((r) => r.artist_id))];

  const artistNames = new Map<string, string>();
  if (artistIds.length > 0) {
    const { data: artists } = await supabase
      .from("artists")
      .select("id, name")
      .in("id", artistIds);
    for (const row of artists ?? []) {
      artistNames.set(row.id, row.name);
    }
  }

  for (const row of rows) {
    map.set(row.id, {
      id: row.id,
      title: row.title,
      artistName: artistNames.get(row.artist_id) ?? "",
      year: row.year,
      coverUrl: row.cover_url ?? undefined,
      spotifyId: row.spotify_id ?? undefined,
    });
  }

  return map;
}

async function loadArtistRefs(
  supabase: Awaited<ReturnType<typeof createClient>>,
  artistIds: string[],
): Promise<Map<string, PollOptionArtistRef>> {
  const map = new Map<string, PollOptionArtistRef>();
  if (artistIds.length === 0) return map;

  const { data } = await supabase
    .from("artists")
    .select("id, name, image_url, spotify_id")
    .in("id", artistIds);

  for (const row of (data ?? []) as ArtistLookupRow[]) {
    map.set(row.id, {
      id: row.id,
      name: row.name,
      imageUrl: row.image_url ?? undefined,
      spotifyId: row.spotify_id ?? undefined,
    });
  }

  return map;
}

export async function getDiscussionPoll(
  threadId: string,
): Promise<DiscussionPoll | null> {
  if (!isSupabaseConfigured()) return null;

  try {
    const supabase = await createClient();
    const { data: optionsData, error: optionsError } = await supabase
      .from("discussion_poll_options")
      .select("*")
      .eq("thread_id", threadId)
      .order("position", { ascending: true });

    if (optionsError || !optionsData || optionsData.length === 0) {
      return null;
    }

    const options = optionsData as DbDiscussionPollOption[];

    const albumIds = options
      .map((o) => o.album_id)
      .filter((id): id is string => !!id);
    const artistIds = options
      .map((o) => o.artist_id)
      .filter((id): id is string => !!id);

    const [counts, albumRefs, artistRefs] = await Promise.all([
      getPollOptionCounts(threadId),
      loadAlbumRefs(supabase, albumIds),
      loadArtistRefs(supabase, artistIds),
    ]);

    const voterKey = await getVoterKey();

    let userVotedOptionId: string | null = null;
    if (voterKey) {
      const { data: vote } = await supabase
        .from("discussion_poll_votes")
        .select("option_id")
        .eq("thread_id", threadId)
        .eq("voter_key", voterKey)
        .maybeSingle();

      userVotedOptionId = vote?.option_id ?? null;
    }

    const mapped: DiscussionPollOption[] = options.map((option) => ({
      id: option.id,
      label: option.label,
      position: option.position,
      voteCount: counts.get(option.id) ?? 0,
      type: option.option_type ?? "text",
      excludeFromTally: option.exclude_from_tally ?? false,
      album: option.album_id ? albumRefs.get(option.album_id) : undefined,
      artist: option.artist_id ? artistRefs.get(option.artist_id) : undefined,
    }));

    const totalVotes = mapped
      .filter((option) => !option.excludeFromTally)
      .reduce((sum, option) => sum + option.voteCount, 0);

    return {
      threadId,
      options: mapped,
      totalVotes,
      userVotedOptionId,
    };
  } catch (err) {
    console.error("[Supabase] getDiscussionPoll:", err);
    return null;
  }
}
