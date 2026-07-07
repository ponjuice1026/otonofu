import { describe, it, expect } from "vitest";
import {
  checkContent,
  checkContentWithWords,
  matchesBannedWords,
  BANNED_PATTERNS,
} from "@/lib/moderation";

describe("checkContent", () => {
  it("通常の本文はnull", () => {
    expect(checkContent("これは普通の投稿です。")).toBeNull();
  });

  it("空文字列はnull", () => {
    expect(checkContent("")).toBeNull();
  });

  it("URL5個までは許容する", () => {
    const body = Array.from({ length: 5 }, (_, i) => `https://example.com/${i}`).join(" ");
    expect(checkContent(body)).toBeNull();
  });

  it("URL6個はエラー（上限5超過）", () => {
    const body = Array.from({ length: 6 }, (_, i) => `https://example.com/${i}`).join(" ");
    expect(checkContent(body)).toBe("URL が多すぎます。数を減らして再度お試しください。");
  });

  it("同一文字30連続は許容する", () => {
    expect(checkContent("あ".repeat(30))).toBeNull();
  });

  it("同一文字31連続はエラー（31文字目で(.)\\1{30}に一致）", () => {
    expect(checkContent("あ".repeat(31))).toBe(
      "同じ文字の繰り返しが多すぎます。内容を見直してください。",
    );
  });

  it("BANNED_PATTERNSはデフォルトで空", () => {
    expect(BANNED_PATTERNS).toEqual([]);
  });
});

describe("matchesBannedWords", () => {
  it("ワードが空なら常にfalse", () => {
    expect(matchesBannedWords("なにかの本文", [])).toBe(false);
  });

  it("本文が空ならfalse", () => {
    expect(matchesBannedWords("", [{ pattern: "禁止" }])).toBe(false);
  });

  it("通常語の部分一致でtrue", () => {
    expect(matchesBannedWords("これは禁止語を含む", [{ pattern: "禁止語" }])).toBe(
      true,
    );
  });

  it("一致しなければfalse", () => {
    expect(matchesBannedWords("普通の投稿", [{ pattern: "禁止語" }])).toBe(false);
  });

  it("通常語は大文字小文字を無視して一致", () => {
    expect(matchesBannedWords("Buy CHEAP now", [{ pattern: "cheap" }])).toBe(true);
  });

  it("空白のみのpatternは無視する", () => {
    expect(matchesBannedWords("なにか", [{ pattern: "   " }])).toBe(false);
  });

  it("正規表現(is_regex)はiフラグで照合", () => {
    expect(
      matchesBannedWords("スパムSPAM文言", [{ pattern: "spam", is_regex: true }]),
    ).toBe(true);
  });

  it("正規表現パターンが機能する", () => {
    expect(
      matchesBannedWords("0120-000-000 へ電話", [
        { pattern: "\\d{4}-\\d{3}-\\d{3}", is_regex: true },
      ]),
    ).toBe(true);
  });

  it("不正な正規表現は無視して他の語の判定を継続", () => {
    const words = [
      { pattern: "(", is_regex: true }, // 不正
      { pattern: "禁止", is_regex: false },
    ];
    expect(matchesBannedWords("これは禁止です", words)).toBe(true);
  });

  it("不正な正規表現のみで一致無しならfalse（例外を投げない）", () => {
    expect(matchesBannedWords("なにか", [{ pattern: "(", is_regex: true }])).toBe(
      false,
    );
  });

  it("複数ワードのいずれかに一致すればtrue", () => {
    const words = [{ pattern: "aaa" }, { pattern: "bbb" }, { pattern: "ccc" }];
    expect(matchesBannedWords("xxbbbxx", words)).toBe(true);
  });
});

describe("checkContentWithWords", () => {
  it("構造チェックが優先される（URL過多）", () => {
    const body = Array.from({ length: 6 }, (_, i) => `https://example.com/${i}`).join(
      " ",
    );
    expect(checkContentWithWords(body, [])).toBe(
      "URL が多すぎます。数を減らして再度お試しください。",
    );
  });

  it("NGワード一致で専用メッセージ", () => {
    expect(checkContentWithWords("これは禁止語です", [{ pattern: "禁止語" }])).toBe(
      "投稿できない内容が含まれています。",
    );
  });

  it("問題なければnull", () => {
    expect(checkContentWithWords("普通の投稿です", [{ pattern: "禁止語" }])).toBeNull();
  });
});
