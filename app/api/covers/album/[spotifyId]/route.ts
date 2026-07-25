import { after, NextResponse } from "next/server";
import { getSpotifyAlbum } from "@/lib/spotify/api";
import { pickImage } from "@/lib/spotify/client";
import { isSpotifyConfigured } from "@/lib/spotify/env";
import {
  fetchSpotifyOEmbedThumbnail,
  spotifyAlbumUrl,
} from "@/lib/spotify/oembed";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/env";

type RouteContext = {
  params: Promise<{ spotifyId: string }>;
};

/**
 * カバー画像の実URL（i.scdn.co）を解決する。
 *
 * 1) Spotify oEmbed（無認証・軽量）。ただし一部のアルバムで 404 を返す。
 * 2) oEmbed が失敗したら Spotify Web API にフォールバック。認証が要るが
 *    確実。oEmbed が落ちる盤でもここで拾えることが多い。
 *
 * どちらでも取れなければ null。
 */
async function resolveCoverUrl(spotifyId: string): Promise<string | null> {
  const thumbnail = await fetchSpotifyOEmbedThumbnail(
    spotifyAlbumUrl(spotifyId),
  );
  if (thumbnail) return thumbnail;

  if (isSpotifyConfigured()) {
    try {
      const album = await getSpotifyAlbum(spotifyId);
      const image = pickImage(album.images, "large");
      if (image) return image;
    } catch (err) {
      console.error("[covers/album] Web API フォールバック失敗:", err);
    }
  }

  return null;
}

/**
 * 解決したカバーURLを albums.cover_url に書き戻す（cover_url が空の行のみ）。
 * 次回以降は albumCoverSrc が cover_url を直接返し、このプロキシを介さず
 * CDN から配信される。閲覧された盤から順にプロキシ依存が解消されていく。
 * レスポンスはブロックしない（after で応答後に実行）。
 */
async function persistCoverUrl(spotifyId: string, coverUrl: string) {
  try {
    const admin = createAdminClient();
    const { error } = await admin
      .from("albums")
      .update({ cover_url: coverUrl })
      .eq("spotify_id", spotifyId)
      .is("cover_url", null);
    if (error) {
      console.error("[covers/album] cover_url 書き戻し失敗:", error.message);
    }
  } catch (err) {
    console.error("[covers/album] cover_url 書き戻し失敗:", err);
  }
}

export async function GET(_request: Request, context: RouteContext) {
  const { spotifyId } = await context.params;

  const coverUrl = await resolveCoverUrl(spotifyId);

  if (!coverUrl) {
    // 解決できない盤で oEmbed / Web API を毎回叩き続けないよう、
    // 404 も一定時間キャッシュする。
    return new NextResponse(null, {
      status: 404,
      headers: { "Cache-Control": "public, max-age=3600" },
    });
  }

  // 解決できたらDBへ自己修復的に書き戻す（応答をブロックしない）。
  if (isSupabaseConfigured()) {
    after(() => persistCoverUrl(spotifyId, coverUrl));
  }

  const image = await fetch(coverUrl);
  if (!image.ok) {
    return new NextResponse(null, { status: 502 });
  }

  const bytes = await image.arrayBuffer();

  return new NextResponse(bytes, {
    headers: {
      "Content-Type": image.headers.get("Content-Type") ?? "image/jpeg",
      "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
    },
  });
}
