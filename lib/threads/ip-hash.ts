import { createHash } from "node:crypto";

/**
 * 投票のcookie依存緩和（IPハッシュ併用）用の純粋関数（監査 B-3）。
 *
 * 目的: discussion_poll_votes は unique(thread_id, voter_key) のみで
 * 二重投票を防いでいたが、voter_key は httpOnly cookie 由来のため
 * cookie を消せば再投票できた。同一スレ・同一IPからの重複投票も
 * DB 側の部分ユニーク制約(thread_id, ip_hash)で抑止する（完全防止ではなく
 * 緩和）。生IPは保存せず、sha256(salt + ip) のハッシュのみを渡す。
 *
 * salt は lib/threads/thread-id-salt.ts と同じ解決順（VIEW_HASH_SALT 等）を
 * 呼び出し側で解決して渡す想定（このファイルは salt を知らない）。
 */

/**
 * x-forwarded-for ヘッダの値から先頭のIPを取り出す。
 * 複数プロキシを経由する場合はカンマ区切りで並ぶため先頭（クライアントに
 * 最も近い側）を採用する。前後空白は除去し、値が無ければ null。
 */
export function extractClientIp(forwardedFor: string | null): string | null {
  if (!forwardedFor) return null;
  const first = forwardedFor.split(",")[0]?.trim();
  return first && first.length > 0 ? first : null;
}

/**
 * IPアドレス文字列と salt から sha256 の16進文字列を計算する（決定的）。
 * 同一入力は常に同一出力になり、出力から生IPを逆算することはできない。
 */
export function hashIp(ip: string, salt: string): string {
  const material = `${salt}:${ip}`;
  return createHash("sha256").update(material, "utf8").digest("hex");
}

/**
 * リクエストの x-forwarded-for ヘッダ値から ip_hash を計算する。
 * IPが取得できない場合は null（=IPハッシュ照合をスキップする）。
 */
export function computeIpHashFromForwardedFor(
  forwardedFor: string | null,
  salt: string,
): string | null {
  const ip = extractClientIp(forwardedFor);
  if (!ip) return null;
  return hashIp(ip, salt);
}
