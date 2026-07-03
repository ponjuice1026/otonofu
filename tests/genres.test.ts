import { describe, it, expect } from "vitest";
import {
  GENRES,
  getGenreBySlug,
  matchGenreSlugs,
  findGenreForLabel,
} from "@/lib/genres";

describe("GENRES", () => {
  it("slugは一意である", () => {
    const slugs = GENRES.map((g) => g.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("全ジャンルにslug/name/nameEn/aliasesがある", () => {
    for (const g of GENRES) {
      expect(g.slug).toBeTruthy();
      expect(g.name).toBeTruthy();
      expect(g.nameEn).toBeTruthy();
      expect(Array.isArray(g.aliases)).toBe(true);
    }
  });
});

describe("getGenreBySlug", () => {
  it("存在するslugを返す", () => {
    expect(getGenreBySlug("j-pop")?.name).toBe("J-Pop");
  });

  it("存在しないslugはundefined", () => {
    expect(getGenreBySlug("no-such-genre")).toBeUndefined();
  });
});

describe("matchGenreSlugs", () => {
  it("空入力は空Set", () => {
    expect(matchGenreSlugs([]).size).toBe(0);
  });

  it("null/undefinedのみは空Set", () => {
    expect(matchGenreSlugs([null, undefined]).size).toBe(0);
  });

  it("aliasにマッチするslugを含む", () => {
    const result = matchGenreSlugs(["city pop"]);
    expect(result.has("city-pop")).toBe(true);
  });

  it("大文字小文字を無視する", () => {
    expect(matchGenreSlugs(["CITY POP"]).has("city-pop")).toBe(true);
  });

  it("日本語エイリアスにマッチする", () => {
    expect(matchGenreSlugs(["渋谷系"]).has("shibuya-kei")).toBe(true);
  });

  it("マッチしなければ空Set", () => {
    expect(matchGenreSlugs(["zzzznonexistent"]).size).toBe(0);
  });
});

describe("findGenreForLabel", () => {
  it("null/undefinedはundefined", () => {
    expect(findGenreForLabel(null)).toBeUndefined();
    expect(findGenreForLabel(undefined)).toBeUndefined();
  });

  it("nameEnの完全一致（大文字小文字無視）", () => {
    expect(findGenreForLabel("Jazz")?.slug).toBe("jazz");
  });

  it("日本語nameの完全一致", () => {
    expect(findGenreForLabel("演歌")?.slug).toBe("enka");
  });

  it("マッチしなければundefined", () => {
    expect(findGenreForLabel("架空のジャンルxyz")).toBeUndefined();
  });
});
