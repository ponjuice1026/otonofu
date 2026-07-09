import { describe, it, expect } from "vitest";
import {
  computeIpHashFromForwardedFor,
  extractClientIp,
  hashIp,
} from "@/lib/threads/ip-hash";

const SALT = "test-salt-abcdef";

describe("extractClientIp", () => {
  it("単一IPをそのまま返す", () => {
    expect(extractClientIp("203.0.113.10")).toBe("203.0.113.10");
  });

  it("カンマ区切りの先頭IPを返す", () => {
    expect(extractClientIp("203.0.113.10, 10.0.0.1, 10.0.0.2")).toBe(
      "203.0.113.10",
    );
  });

  it("前後の空白を除去する", () => {
    expect(extractClientIp("  203.0.113.10  , 10.0.0.1")).toBe(
      "203.0.113.10",
    );
  });

  it("null は null を返す", () => {
    expect(extractClientIp(null)).toBeNull();
  });

  it("空文字は null を返す", () => {
    expect(extractClientIp("")).toBeNull();
  });

  it("カンマのみ（先頭が空）は null を返す", () => {
    expect(extractClientIp(" , 10.0.0.1")).toBeNull();
  });
});

describe("hashIp", () => {
  it("同一入力なら同一出力（決定的）", () => {
    expect(hashIp("203.0.113.10", SALT)).toBe(hashIp("203.0.113.10", SALT));
  });

  it("sha256 hex（64文字・16進）を返す", () => {
    const hash = hashIp("203.0.113.10", SALT);
    expect(hash).toHaveLength(64);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("IPが違えばハッシュが変わる", () => {
    const a = hashIp("203.0.113.10", SALT);
    const b = hashIp("203.0.113.11", SALT);
    expect(a).not.toBe(b);
  });

  it("saltが違えばハッシュが変わる", () => {
    const a = hashIp("203.0.113.10", "salt-one");
    const b = hashIp("203.0.113.10", "salt-two");
    expect(a).not.toBe(b);
  });

  it("出力に生IPが含まれない（復元不能性の最低限の担保）", () => {
    const ip = "203.0.113.10";
    const hash = hashIp(ip, SALT);
    expect(hash).not.toContain(ip);
  });
});

describe("computeIpHashFromForwardedFor", () => {
  it("x-forwarded-for からハッシュを計算する", () => {
    const hash = computeIpHashFromForwardedFor("203.0.113.10, 10.0.0.1", SALT);
    expect(hash).toBe(hashIp("203.0.113.10", SALT));
  });

  it("ヘッダが無ければ null を返す", () => {
    expect(computeIpHashFromForwardedFor(null, SALT)).toBeNull();
  });

  it("ヘッダが空文字なら null を返す", () => {
    expect(computeIpHashFromForwardedFor("", SALT)).toBeNull();
  });
});
