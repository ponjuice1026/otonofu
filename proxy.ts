import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const VIEW_COOKIE = "otonofu_viewed_threads";
const VIEW_COOKIE_MAX_AGE = 60 * 60 * 6;
const MAX_TRACKED = 200;

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

  const viewedRaw = request.cookies.get(VIEW_COOKIE)?.value ?? "";
  const viewed = viewedRaw.split(",").filter((value) => value.length > 0);
  if (viewed.includes(threadId)) return;

  try {
    await fetch(`${supabaseUrl}/rest/v1/rpc/increment_thread_views`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
      },
      body: JSON.stringify({ target_id: threadId }),
    });
  } catch (err) {
    console.error("[proxy] increment_thread_views:", err);
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

  if (!url || !key) {
    const response = NextResponse.next({ request });
    await trackThreadView(request, response, url, key);
    return response;
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(url, key, {
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

  await trackThreadView(request, response, url, key);

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
