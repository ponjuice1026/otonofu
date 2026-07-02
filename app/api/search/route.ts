import { NextResponse } from "next/server";
import { searchCatalog } from "@/lib/data/search";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q")?.trim() ?? "";
  const limitParam = Number(searchParams.get("limit") ?? "8");
  const limit = Number.isFinite(limitParam) ? limitParam : 8;

  if (query.length < 1) {
    return NextResponse.json({
      artists: [],
      albums: [],
      threads: [],
      reviews: [],
      posts: [],
    });
  }

  const results = await searchCatalog(query, limit);

  return NextResponse.json(results, {
    headers: {
      "Cache-Control": "private, max-age=30",
    },
  });
}
