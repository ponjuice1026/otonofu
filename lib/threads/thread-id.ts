import { createHash } from "node:crypto";

/**
 * 5ch 式の「スレ内ID」を生成する純粋関数群。
 *
 * 目的: 同一スレッド内で同一投稿者を、匿名のまま短いIDで見分ける。
 * 日付(JST)が変わるとIDも変わる（5ch と同じ挙動）。
 *
 * 匿名性の要:
 *   - 入力の生 key（voter_key / user_id）は sha256 + サーバー salt を通すため、
 *     出力IDから元の key を復元することはできない（一方向）。
 *   - salt が漏れない限り、第三者は「このIDのkeyは何か」を逆算できない。
 *   - salt はサーバー側 env でのみ保持し、DBにはハッシュ結果のみ保存する。
 */

const BASE62 =
  "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

/** フィールド境界を明示する区切り（Unit Separator, U+001F）。 */
const FIELD_SEPARATOR = "";

/** スレ内IDの文字数（先頭から採用する桁数）。 */
export const THREAD_LOCAL_ID_LENGTH = 8;

/**
 * バイト列を base62 文字列へ変換する（先頭バイトから貪欲に）。
 * ハッシュのバイト列を大きな整数と見なし 62 進数に落とす。
 */
function bytesToBase62(bytes: Uint8Array): string {
  // BigInt でバイト列全体を一つの整数として扱う。
  // tsconfig の target が ES2017 のため BigInt リテラル(0n 等)は使えない。
  // BigInt() コンストラクタで生成する（ランタイム挙動は同一）。
  const ZERO = BigInt(0);
  const SHIFT = BigInt(8);
  const base = BigInt(62);

  let value = ZERO;
  for (const byte of bytes) {
    value = (value << SHIFT) | BigInt(byte);
  }
  if (value === ZERO) return "0";

  let out = "";
  while (value > ZERO) {
    const rem = Number(value % base);
    out = BASE62[rem] + out;
    value /= base;
  }
  return out;
}

/**
 * ある瞬間(UTC)の JST 日付キー "YYYY-MM-DD" を返す。
 * JST(UTC+9)固定オフセットで計算する（DST 無し）。
 */
export function jstDateKey(date: Date): string {
  const jstMs = date.getTime() + 9 * 60 * 60 * 1000;
  const jst = new Date(jstMs);
  const year = jst.getUTCFullYear();
  const month = String(jst.getUTCMonth() + 1).padStart(2, "0");
  const day = String(jst.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export type ThreadLocalIdInput = {
  /** 匿名は voter_key、ログインは user_id。投稿者を一意に示すキー。 */
  identityKey: string;
  /** スレッドID。スレッドをまたぐと別IDになる。 */
  threadId: string;
  /** JST 日付キー "YYYY-MM-DD"。日付が変わると別IDになる。 */
  jstDate: string;
  /** サーバー側 salt。これが無いと逆算耐性が失われる。 */
  salt: string;
};

/**
 * スレ内IDを計算する純粋関数。
 * 同一入力 → 同一出力、異なる thread/日付/key → 異なる出力。
 * salt を通すため出力から生 key は復元不能。
 */
export function computeThreadLocalId(input: ThreadLocalIdInput): string {
  const { identityKey, threadId, jstDate, salt } = input;
  // 「a|b」と「ab|」のような境界衝突を防ぐため区切り文字で連結する。
  const material = [salt, threadId, jstDate, identityKey].join(FIELD_SEPARATOR);
  const digest = createHash("sha256").update(material, "utf8").digest();
  const encoded = bytesToBase62(new Uint8Array(digest));
  // base62 化で桁が不足するケースに備えパディングしてから採用桁数で切り出す。
  return encoded
    .padStart(THREAD_LOCAL_ID_LENGTH, "0")
    .slice(0, THREAD_LOCAL_ID_LENGTH);
}
