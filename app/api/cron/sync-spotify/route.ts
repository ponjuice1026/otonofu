import { NextResponse } from "next/server";
import { runSpotifyQueueSync } from "@/lib/spotify/run-sync";

export const runtime = "nodejs";
export const maxDuration = 300;

function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;

  const auth = request.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const batchSize = Number(process.env.SPOTIFY_SYNC_BATCH_SIZE ?? 30);

  try {
    const result = await runSpotifyQueueSync({
      batchSize: Number.isFinite(batchSize) ? batchSize : 30,
    });

    return NextResponse.json({
      ok: true,
      ...result,
      finishedAt: new Date().toISOString(),
    });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      },
      { status: 500 },
    );
  }
}
