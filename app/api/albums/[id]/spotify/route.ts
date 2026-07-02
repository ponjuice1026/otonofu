import { NextResponse } from "next/server";
import { getAlbumById } from "@/lib/data/albums";
import { getAlbumTracksFromDb } from "@/lib/data/tracks";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const album = await getAlbumById(id);

  if (!album) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const tracks = getAlbumTracksFromDb(album);

  return NextResponse.json({
    tracks,
    spotifyUrl: album.spotifyId
      ? `https://open.spotify.com/album/${album.spotifyId}`
      : null,
  });
}
