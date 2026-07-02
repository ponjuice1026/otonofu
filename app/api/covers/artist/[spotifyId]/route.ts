import { NextResponse } from "next/server";
import {
  fetchSpotifyOEmbedThumbnail,
  spotifyArtistUrl,
} from "@/lib/spotify/oembed";

type RouteContext = {
  params: Promise<{ spotifyId: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { spotifyId } = await context.params;
  const thumbnail = await fetchSpotifyOEmbedThumbnail(spotifyArtistUrl(spotifyId));

  if (!thumbnail) {
    return new NextResponse(null, { status: 404 });
  }

  const image = await fetch(thumbnail);
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
