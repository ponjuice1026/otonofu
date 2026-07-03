import { describe, it, expect } from "vitest";
import {
  normalizeSearchText,
  matchesSearchQuery,
  searchMatchScore,
} from "@/lib/search/normalize";

describe("normalizeSearchText", () => {
  it("空文字列はそのまま空文字列", () => {
    expect(normalizeSearchText("")).toBe("");
  });

  it("カタカナをひらがなに変換する", () => {
    expect(normalizeSearchText("ミスチル")).toBe("みすちる");
  });

  it("ヴなどの拡張カタカナもひらがな化する（U+30F4→U+3094）", () => {
    expect(normalizeSearchText("ヴ")).toBe("ゔ");
  });

  it("全角英数を半角化して小文字にする（NFKC + lowercase）", () => {
    expect(normalizeSearchText("ＡＢＣ")).toBe("abc");
  });

  it("英字を小文字化する", () => {
    expect(normalizeSearchText("RADWIMPS")).toBe("radwimps");
  });

  it("長音符ーを除去する", () => {
    expect(normalizeSearchText("スーパー")).toBe("すぱ");
  });

  it("中黒・を除去する", () => {
    expect(normalizeSearchText("A・B")).toBe("ab");
  });

  it("半角中黒･(U+FF65)を除去する", () => {
    expect(normalizeSearchText("A･B")).toBe("ab");
  });

  it("波ダッシュ〜(U+301C)を除去する", () => {
    expect(normalizeSearchText("a〜b")).toBe("ab");
  });

  it("全角スペースと半角スペースを除去する", () => {
    expect(normalizeSearchText("a b　c")).toBe("abc");
  });

  it("半角カナをNFKCで全角化した上でひらがな化する", () => {
    // U+FF7A(ｺ) U+FF9B(ﾛ) -> NFKC -> コロ -> ころ
    expect(normalizeSearchText("ｺﾛ")).toBe("ころ");
  });

  it("カタカナとひらがなの表記ゆれを同一に正規化する", () => {
    expect(normalizeSearchText("ラルク")).toBe(normalizeSearchText("らるく"));
  });
});

describe("matchesSearchQuery", () => {
  it("空クエリは常にfalse", () => {
    expect(matchesSearchQuery("", "abc")).toBe(false);
  });

  it("空白のみのクエリはfalse", () => {
    expect(matchesSearchQuery("   ", "abc")).toBe(false);
  });

  it("有効なフィールドが無ければfalse", () => {
    expect(matchesSearchQuery("abc", null, undefined, "  ")).toBe(false);
  });

  it("小文字部分一致でtrue", () => {
    expect(matchesSearchQuery("Rad", "RADWIMPS")).toBe(true);
  });

  it("カタカナ/ひらがな表記ゆれで一致する", () => {
    expect(matchesSearchQuery("みすちる", "ミスチル")).toBe(true);
  });

  it("一致しなければfalse", () => {
    expect(matchesSearchQuery("xyz", "ミスチル")).toBe(false);
  });

  it("複数トークンは全トークンが含まれる必要がある", () => {
    expect(matchesSearchQuery("john lennon", "John Lennon")).toBe(true);
    expect(matchesSearchQuery("john ringo", "John Lennon")).toBe(false);
  });
});

describe("searchMatchScore", () => {
  it("一致しなければ0", () => {
    expect(searchMatchScore("xyz", "abc")).toBe(0);
  });

  it("完全一致は100", () => {
    expect(searchMatchScore("abc", "abc")).toBe(100);
  });

  it("正規化後の完全一致も100（カタカナ vs ひらがな）", () => {
    expect(searchMatchScore("みすちる", "ミスチル")).toBe(100);
  });

  it("前方一致は80", () => {
    expect(searchMatchScore("rad", "radwimps")).toBe(80);
  });

  it("部分一致（中間）は60", () => {
    expect(searchMatchScore("wimp", "radwimps")).toBe(60);
  });
});
