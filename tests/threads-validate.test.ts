import { describe, it, expect } from "vitest";
import {
  normalizeTitle,
  normalizeThreadBody,
  normalizePostBody,
  normalizeAnonymousName,
  profilePostName,
  normalizeDraftTitle,
  validateTitle,
  validateThreadBody,
  validatePostBody,
  normalizePollOptionLabel,
  parsePollOptionsFromFormData,
  validatePollOptions,
  validatePollOptionAdd,
  type PollOptionInput,
} from "@/lib/threads/validate";

describe("normalizeTitle", () => {
  it("前後の空白を除去する", () => {
    expect(normalizeTitle("  hello  ")).toBe("hello");
  });

  it("120字を超えたら切り詰める", () => {
    const long = "あ".repeat(200);
    expect(normalizeTitle(long)).toHaveLength(120);
  });

  it("空文字は空文字", () => {
    expect(normalizeTitle("   ")).toBe("");
  });
});

describe("normalizeThreadBody / normalizePostBody", () => {
  it("4000字を超えたら切り詰める（thread）", () => {
    expect(normalizeThreadBody("a".repeat(5000))).toHaveLength(4000);
  });

  it("4000字を超えたら切り詰める（post）", () => {
    expect(normalizePostBody("a".repeat(5000))).toHaveLength(4000);
  });

  it("trimする", () => {
    expect(normalizePostBody("  x  ")).toBe("x");
  });
});

describe("normalizeAnonymousName", () => {
  it("入力があればそれをtrimして返す", () => {
    expect(normalizeAnonymousName("  太郎 ")).toBe("太郎");
  });

  it("24字を超えたら切り詰める", () => {
    expect(normalizeAnonymousName("x".repeat(50))).toHaveLength(24);
  });

  it("空なら「名無し」+4桁の乱数を返す", () => {
    const name = normalizeAnonymousName("   ");
    expect(name).toMatch(/^名無し\d{4}$/);
  });
});

describe("profilePostName", () => {
  it("displayNameがあればそれを優先する", () => {
    expect(profilePostName("表示名", "username")).toBe("表示名");
  });

  it("displayNameが空ならusernameを使う", () => {
    expect(profilePostName("  ", "username")).toBe("username");
  });

  it("両方空なら「ユーザー」", () => {
    expect(profilePostName(null, "  ")).toBe("ユーザー");
  });

  it("24字を超えたら切り詰める", () => {
    expect(profilePostName("あ".repeat(40), "u")).toHaveLength(24);
  });
});

describe("normalizeDraftTitle", () => {
  it("タイトルがあればそのまま", () => {
    expect(normalizeDraftTitle("題名")).toBe("題名");
  });

  it("空なら「（無題）」", () => {
    expect(normalizeDraftTitle("   ")).toBe("（無題）");
  });
});

describe("validateTitle", () => {
  it("有効なタイトルはnull", () => {
    expect(validateTitle("あるタイトル")).toBeNull();
  });

  it("空はエラーメッセージ", () => {
    expect(validateTitle("  ")).toBe("タイトルを入力してください。");
  });
});

describe("validateThreadBody", () => {
  it("有効な本文はnull", () => {
    expect(validateThreadBody("説明文")).toBeNull();
  });

  it("空はエラーメッセージ", () => {
    expect(validateThreadBody("")).toBe("セッションの説明を入力してください。");
  });
});

describe("validatePostBody", () => {
  it("有効な本文はnull", () => {
    expect(validatePostBody("コメント")).toBeNull();
  });

  it("空はエラーメッセージ", () => {
    expect(validatePostBody("   ")).toBe("コメントを入力してください。");
  });
});

describe("normalizePollOptionLabel", () => {
  it("80字を超えたら切り詰める", () => {
    expect(normalizePollOptionLabel("x".repeat(100))).toHaveLength(80);
  });

  it("trimする", () => {
    expect(normalizePollOptionLabel("  y  ")).toBe("y");
  });
});

describe("parsePollOptionsFromFormData", () => {
  function fd(json: string | null): FormData {
    const f = new FormData();
    if (json !== null) f.set("pollOptionsJson", json);
    return f;
  }

  it("フィールドが無ければ空配列", () => {
    expect(parsePollOptionsFromFormData(fd(null))).toEqual([]);
  });

  it("不正なJSONは空配列", () => {
    expect(parsePollOptionsFromFormData(fd("{not json"))).toEqual([]);
  });

  it("配列でなければ空配列", () => {
    expect(parsePollOptionsFromFormData(fd('{"a":1}'))).toEqual([]);
  });

  it("textオプションをパースする", () => {
    const result = parsePollOptionsFromFormData(
      fd(JSON.stringify([{ type: "text", label: "選択肢A" }])),
    );
    expect(result).toEqual([
      { type: "text", label: "選択肢A", albumId: undefined, artistId: undefined, excludeFromTally: false },
    ]);
  });

  it("labelが空のオプションは除外する", () => {
    const result = parsePollOptionsFromFormData(
      fd(JSON.stringify([{ type: "text", label: "  " }])),
    );
    expect(result).toEqual([]);
  });

  it("albumタイプでalbumIdが無ければ除外する", () => {
    const result = parsePollOptionsFromFormData(
      fd(JSON.stringify([{ type: "album", label: "アルバム" }])),
    );
    expect(result).toEqual([]);
  });

  it("albumタイプでalbumIdがあれば保持する", () => {
    const result = parsePollOptionsFromFormData(
      fd(JSON.stringify([{ type: "album", label: "アルバム", albumId: "al1" }])),
    );
    expect(result).toEqual([
      { type: "album", label: "アルバム", albumId: "al1", artistId: undefined, excludeFromTally: false },
    ]);
  });

  it("重複するtextラベルは除外する（大文字小文字無視）", () => {
    const result = parsePollOptionsFromFormData(
      fd(JSON.stringify([
        { type: "text", label: "ABC" },
        { type: "text", label: "abc" },
      ])),
    );
    expect(result).toHaveLength(1);
  });

  it("未知のtypeはtextにフォールバックする", () => {
    const result = parsePollOptionsFromFormData(
      fd(JSON.stringify([{ type: "weird", label: "X" }])),
    );
    expect(result[0].type).toBe("text");
  });
});

describe("validatePollOptions", () => {
  const opt = (label: string): PollOptionInput => ({
    type: "text",
    label,
    excludeFromTally: false,
  });

  it("2つ未満はエラー", () => {
    expect(validatePollOptions([opt("a")])).toBe("選択肢は2つ以上入力してください。");
  });

  it("2〜8はnull", () => {
    expect(validatePollOptions([opt("a"), opt("b")])).toBeNull();
  });

  it("8つ超はエラー", () => {
    const many = Array.from({ length: 9 }, (_, i) => opt(`o${i}`));
    expect(validatePollOptions(many)).toBe("選択肢は8つまでです。");
  });
});

describe("validatePollOptionAdd", () => {
  const opt = (label: string): PollOptionInput => ({
    type: "text",
    label,
    excludeFromTally: false,
  });

  it("1つでラベルがあればnull", () => {
    expect(validatePollOptionAdd([opt("a")])).toBeNull();
  });

  it("0個はエラー", () => {
    expect(validatePollOptionAdd([])).toBe("追加する選択肢を1つ指定してください。");
  });

  it("2個以上はエラー", () => {
    expect(validatePollOptionAdd([opt("a"), opt("b")])).toBe(
      "追加する選択肢を1つ指定してください。",
    );
  });

  it("ラベルが空はエラー", () => {
    expect(validatePollOptionAdd([opt("")])).toBe("選択肢を入力してください。");
  });
});
