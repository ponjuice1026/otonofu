/**
 * Supabase (@supabase/ssr) のセッション Cookie が存在するかを判定する。
 *
 * デフォルトのトークン Cookie 名は `sb-<project-ref>-auth-token`（サイズが
 * 大きい場合は `.0` `.1` … に分割される）。セッションが無い匿名リクエストで
 * これが無ければ `auth.getUser()`（Supabase 認証サーバへのネットワーク往復）を
 * 呼ぶ必要はない。全ページ・全ナビゲーションで走る proxy と各ページの
 * getUser の両方で使い、匿名アクセスの認証往復を省く。
 */
export function hasSupabaseAuthCookie(
  cookies: ReadonlyArray<{ name: string }>,
): boolean {
  return cookies.some(
    (cookie) =>
      cookie.name.startsWith("sb-") && cookie.name.includes("auth-token"),
  );
}
