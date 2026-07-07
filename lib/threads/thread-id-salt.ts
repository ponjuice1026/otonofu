/**
 * スレ内ID(thread_local_id)生成に使うサーバー側 salt を解決する。
 *
 * 優先順位:
 *   1. THREAD_ID_SALT（この機能専用の env。推奨）
 *   2. VIEW_HASH_SALT（既存の汎用ハッシュ salt があれば流用）
 *   3. NEXT_PUBLIC_SUPABASE_URL（最終フォールバック。プロジェクト固有値）
 *
 * salt はサーバー内でのみ使用し、クライアントへは出さない。
 * 生 key の逆算耐性は salt の秘匿性に依存するため、本番では
 * THREAD_ID_SALT を必ず設定すること（README/env で案内）。
 */
export function resolveThreadIdSalt(): string {
  return (
    process.env.THREAD_ID_SALT?.trim() ||
    process.env.VIEW_HASH_SALT?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
    "otonofu-thread-id-fallback-salt"
  );
}
