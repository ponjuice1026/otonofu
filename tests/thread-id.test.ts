import { describe, it, expect } from "vitest";
import {
  computeThreadLocalId,
  jstDateKey,
  THREAD_LOCAL_ID_LENGTH,
} from "@/lib/threads/thread-id";

const SALT = "test-salt-abcdef";

describe("computeThreadLocalId", () => {
  it("同一入力なら同一出力（決定的）", () => {
    const input = {
      identityKey: "voter-key-1",
      threadId: "thread-a",
      jstDate: "2026-07-07",
      salt: SALT,
    };
    expect(computeThreadLocalId(input)).toBe(computeThreadLocalId(input));
  });

  it("採用桁数どおりの長さになる", () => {
    const id = computeThreadLocalId({
      identityKey: "voter-key-1",
      threadId: "thread-a",
      jstDate: "2026-07-07",
      salt: SALT,
    });
    expect(id).toHaveLength(THREAD_LOCAL_ID_LENGTH);
    expect(id).toMatch(/^[0-9A-Za-z]+$/);
  });

  it("スレッドが違えばIDが変わる", () => {
    const base = {
      identityKey: "voter-key-1",
      jstDate: "2026-07-07",
      salt: SALT,
    };
    const a = computeThreadLocalId({ ...base, threadId: "thread-a" });
    const b = computeThreadLocalId({ ...base, threadId: "thread-b" });
    expect(a).not.toBe(b);
  });

  it("日付が違えばIDが変わる", () => {
    const base = {
      identityKey: "voter-key-1",
      threadId: "thread-a",
      salt: SALT,
    };
    const a = computeThreadLocalId({ ...base, jstDate: "2026-07-07" });
    const b = computeThreadLocalId({ ...base, jstDate: "2026-07-08" });
    expect(a).not.toBe(b);
  });

  it("投稿者キーが違えばIDが変わる", () => {
    const base = {
      threadId: "thread-a",
      jstDate: "2026-07-07",
      salt: SALT,
    };
    const a = computeThreadLocalId({ ...base, identityKey: "voter-key-1" });
    const b = computeThreadLocalId({ ...base, identityKey: "voter-key-2" });
    expect(a).not.toBe(b);
  });

  it("salt が違えばIDが変わる", () => {
    const base = {
      identityKey: "voter-key-1",
      threadId: "thread-a",
      jstDate: "2026-07-07",
    };
    const a = computeThreadLocalId({ ...base, salt: "salt-one" });
    const b = computeThreadLocalId({ ...base, salt: "salt-two" });
    expect(a).not.toBe(b);
  });

  it("出力に生の identityKey が含まれない（復元不能性の最低限の担保）", () => {
    const identityKey = "super-secret-voter-key-value";
    const id = computeThreadLocalId({
      identityKey,
      threadId: "thread-a",
      jstDate: "2026-07-07",
      salt: SALT,
    });
    expect(id).not.toContain(identityKey);
    expect(identityKey).not.toContain(id);
  });

  it("フィールド境界の衝突が起きない（連結順の入れ替えで別ID）", () => {
    // identityKey と threadId を入れ替えても同じIDにならないこと。
    const a = computeThreadLocalId({
      identityKey: "ab",
      threadId: "c",
      jstDate: "2026-07-07",
      salt: SALT,
    });
    const b = computeThreadLocalId({
      identityKey: "a",
      threadId: "bc",
      jstDate: "2026-07-07",
      salt: SALT,
    });
    expect(a).not.toBe(b);
  });
});

describe("jstDateKey", () => {
  it("UTC深夜はJSTでは翌日になる", () => {
    // 2026-07-07T16:00:00Z = 2026-07-08T01:00:00 JST
    expect(jstDateKey(new Date("2026-07-07T16:00:00Z"))).toBe("2026-07-08");
  });

  it("JST日中は同日", () => {
    // 2026-07-07T03:00:00Z = 2026-07-07T12:00:00 JST
    expect(jstDateKey(new Date("2026-07-07T03:00:00Z"))).toBe("2026-07-07");
  });

  it("JSTの日付境界直前（14:59Z=23:59JST）は同日", () => {
    expect(jstDateKey(new Date("2026-07-07T14:59:00Z"))).toBe("2026-07-07");
  });

  it("JSTの日付境界（15:00Z=00:00JST翌日）は翌日", () => {
    expect(jstDateKey(new Date("2026-07-07T15:00:00Z"))).toBe("2026-07-08");
  });
});
