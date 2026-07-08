/**
 * Spotify API への接続テスト
 * 実行: npm run sync:probe
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

function loadEnvLocal() {
  const envPath = resolve(process.cwd(), ".env.local");
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (!process.env[key]) process.env[key] = value;
  }
}

async function main() {
  loadEnvLocal();

  const id = process.env.SPOTIFY_CLIENT_ID;
  const sec = process.env.SPOTIFY_CLIENT_SECRET;
  if (!id || !sec) {
    console.error("SPOTIFY_CLIENT_ID / SECRET 未設定");
    process.exit(1);
  }

  const cred = Buffer.from(`${id}:${sec}`).toString("base64");

  console.log("⏳ token 取得中…");
  const tStart = Date.now();
  const tr = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${cred}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  console.log(`   ${tr.status} in ${Date.now() - tStart}ms`);

  if (!tr.ok) {
    console.error("Token error:", await tr.text());
    process.exit(1);
  }

  const token = (await tr.json()).access_token;

  const tests = [
    "/search?q=Tokyo+band&type=artist&limit=10&market=JP",
    "/search?q=genre%3A%22j-pop%22&type=artist&limit=10&market=JP",
    "/search?q=YOASOBI&type=artist&limit=5&market=JP",
    "/search?q=邦楽&type=artist&limit=10&market=JP",
  ];

  for (const path of tests) {
    await new Promise((r) => setTimeout(r, 1500));
    const start = Date.now();
    const res = await fetch(`https://api.spotify.com/v1${path}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const ra = res.headers.get("Retry-After");
    const tag = path.length > 70 ? `${path.slice(0, 70)}...` : path;
    console.log(
      `   ${res.status} (${Date.now() - start}ms) ${tag}${ra ? ` Retry-After=${ra}s` : ""}`,
    );

    if (!res.ok) {
      const body = await res.text();
      console.log(`      body: ${body.slice(0, 200)}`);
    } else if (path.startsWith("/search")) {
      const body = (await res.json()) as {
        artists?: {
          items?: Array<{
            name?: string;
            followers?: { total?: number };
            popularity?: number;
          }>;
          total?: number;
        };
      };
      const items = body.artists?.items ?? [];
      console.log(`      found ${items.length} artists, total=${body.artists?.total}`);
      for (const a of items.slice(0, 3)) {
        console.log(`        - ${a.name} followers=${a.followers?.total ?? "null"} pop=${a.popularity}`);
      }
    }
  }
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
