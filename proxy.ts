import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { hasSupabaseAuthCookie } from "@/lib/auth/auth-cookie";

const VIEW_COOKIE = "otonofu_viewed_threads";
const VIEW_COOKIE_MAX_AGE = 60 * 60 * 6;
const MAX_TRACKED = 200;

// 閲覧者識別用 cookie（lib/threads/voter.ts と同じ名前）。
const VOTER_COOKIE = "otonofu_poll_voter";

/**
 * viewer_hash を組み立てる。voter cookie（無ければ x-forwarded-for の
 * 先頭 IP）と salt(VIEW_HASH_SALT、無ければ Supabase URL)を sha256 して
 * サーバ側で決まる識別子にする。クライアントは salt を知らないため、
 * 任意の viewer_hash を偽装して水増しすることはできない。
 */
async function buildViewerHash(
  request: NextRequest,
  supabaseUrl: string,
): Promise<string | null> {
  const voter = request.cookies.get(VOTER_COOKIE)?.value?.trim();
  const forwardedFor = request.headers.get("x-forwarded-for") ?? "";
  const ip = forwardedFor.split(",")[0]?.trim();
  const subject = voter && voter.length >= 16 ? voter : ip;
  if (!subject) return null;

  const salt = process.env.VIEW_HASH_SALT ?? supabaseUrl;
  const data = new TextEncoder().encode(`${salt}:${subject}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const THREAD_DETAIL_RE = /^\/threads\/([^/]+)\/?$/;

function isPrefetch(request: NextRequest): boolean {
  const purpose = request.headers.get("purpose")?.toLowerCase();
  if (purpose === "prefetch") return true;
  if (request.headers.get("next-router-prefetch")) return true;
  if (request.headers.get("rsc")) return true;
  return false;
}

async function trackThreadView(
  request: NextRequest,
  response: NextResponse,
  supabaseUrl: string | undefined,
  supabaseKey: string | undefined,
): Promise<void> {
  if (!supabaseUrl || !supabaseKey) return;
  if (request.method !== "GET") return;
  if (isPrefetch(request)) return;

  const match = request.nextUrl.pathname.match(THREAD_DETAIL_RE);
  if (!match) return;

  const threadId = match[1];
  if (!UUID_RE.test(threadId)) return;

  // クライアント cookie による dedup（DB 負荷軽減のため残す。ただし
  // これは信頼境界ではない。実際の重複排除は DB 側 viewer_hash で行う）。
  const viewedRaw = request.cookies.get(VIEW_COOKIE)?.value ?? "";
  const viewed = viewedRaw.split(",").filter((value) => value.length > 0);
  if (viewed.includes(threadId)) return;

  // サーバ側で決まる viewer_hash を作り、重複排除つき RPC を呼ぶ（A-3）。
  const viewerHash = await buildViewerHash(request, supabaseUrl);
  if (!viewerHash) return;

  try {
    await fetch(`${supabaseUrl}/rest/v1/rpc/increment_thread_views_dedup`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
      },
      body: JSON.stringify({ target_id: threadId, viewer_hash: viewerHash }),
    });
  } catch (err) {
    console.error("[proxy] increment_thread_views_dedup:", err);
    return;
  }

  const next = [...viewed, threadId].slice(-MAX_TRACKED).join(",");
  response.cookies.set(VIEW_COOKIE, next, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: VIEW_COOKIE_MAX_AGE,
    path: "/",
  });
}

export async function proxy(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  let response = NextResponse.next({ request });

  // セッション Cookie を持つログイン済みリクエストのみトークンを更新する。
  // 匿名リクエストやプリフェッチでは auth.getUser()（Supabase 認証サーバへの
  // ネットワーク往復）をスキップ。proxy は全ページ・全ナビゲーションで走るため
  // ここの往復削減が体感速度に効く。
  const shouldRefreshSession =
    Boolean(url && key) &&
    !isPrefetch(request) &&
    hasSupabaseAuthCookie(request.cookies.getAll());

  if (shouldRefreshSession) {
    const supabase = createServerClient(url!, key!, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    });

    try {
      await supabase.auth.getUser();
    } catch (err) {
      console.error("[proxy] getUser:", err);
    }
  }

  await trackThreadView(request, response, url, key);

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
