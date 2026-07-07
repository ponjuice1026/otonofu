import { describe, it, expect } from "vitest";
import {
  escapeLikePattern,
  quotePostgrestValue,
  buildIlikeContainsFilter,
  buildIlikeOrFilter,
} from "@/lib/search/postgrest-filter";

describe("escapeLikePattern", () => {
  it("通常の文字列は変化しない", () => {
    expect(escapeLikePattern("hello")).toBe("hello");
    expect(escapeLikePattern("あいうえお")).toBe("あいうえお");
  });

  it("% をエスケープする", () => {
    expect(escapeLikePattern("50%")).toBe("50\\%");
  });

  it("_ をエスケープする", () => {
    expect(escapeLikePattern("a_b")).toBe("a\\_b");
  });

  it("バックスラッシュを先にエスケープし二重化を防ぐ", () => {
    // 入力 "\%" → バックスラッシュ→"\\", 続いて % → "\%" で "\\\%"
    expect(escapeLikePattern("\\%")).toBe("\\\\\\%");
  });

  it("複数のワイルドカードを同時に処理する", () => {
    expect(escapeLikePattern("a%b_c")).toBe("a\\%b\\_c");
  });
});

describe("quotePostgrestValue", () => {
  it("予約文字を含まなければクォートしない", () => {
    expect(quotePostgrestValue("hello")).toBe("hello");
    expect(quotePostgrestValue("あいう")).toBe("あいう");
    expect(quotePostgrestValue("%abc%")).toBe("%abc%");
  });

  it("カンマを含む値はクォートする", () => {
    expect(quotePostgrestValue("a,b")).toBe('"a,b"');
  });

  it("丸括弧を含む値はクォートする", () => {
    expect(quotePostgrestValue("f(x)")).toBe('"f(x)"');
  });

  it("ドット・コロン・空白を含む値はクォートする", () => {
    expect(quotePostgrestValue("a.b")).toBe('"a.b"');
    expect(quotePostgrestValue("a:b")).toBe('"a:b"');
    expect(quotePostgrestValue("a b")).toBe('"a b"');
  });

  it("内部の \" をエスケープしてクォートする", () => {
    // 値に " が含まれると予約文字判定→クォート、内部の " は \" に
    expect(quotePostgrestValue('a"b')).toBe('"a\\"b"');
  });

  it("内部の バックスラッシュ をエスケープしてクォートする", () => {
    // "\\" は予約文字なのでクォート対象、\ は \\ に
    expect(quotePostgrestValue("a\\b")).toBe('"a\\\\b"');
  });
});

describe("buildIlikeContainsFilter", () => {
  it("通常語は %...% の中間一致（クォート無し）", () => {
    expect(buildIlikeContainsFilter("title", "rock")).toBe("title.ilike.%rock%");
  });

  it("ワイルドカードをエスケープする", () => {
    // % を \% にエスケープすると値にバックスラッシュが入る。バックスラッシュは
    // 予約文字なのでダブルクォートで包み、内部の \ をさらに \\ にする。
    // PostgREST はクォートを外して %50\%% を Postgres に渡し、\% はリテラルの % になる。
    expect(buildIlikeContainsFilter("title", "50%")).toBe('title.ilike."%50\\\\%%"');
  });

  it("カンマ注入はクォートで無害化される", () => {
    // "a,b" → パターン "%a,b%" は予約文字(,)を含むためクォート
    expect(buildIlikeContainsFilter("title", "a,b")).toBe('title.ilike."%a,b%"');
  });

  it("丸括弧注入はクォートで無害化される", () => {
    expect(buildIlikeContainsFilter("body", "or(x)")).toBe('body.ilike."%or(x)%"');
  });
});

describe("buildIlikeOrFilter", () => {
  it("複数カラムをカンマ結合する", () => {
    expect(buildIlikeOrFilter(["title", "body"], "rock")).toBe(
      "title.ilike.%rock%,body.ilike.%rock%",
    );
  });

  it("カラム区切りのカンマと値内カンマが混同されない", () => {
    // 値 "a,b" はクォートされるので、区切りの , と衝突しない
    expect(buildIlikeOrFilter(["title", "body"], "a,b")).toBe(
      'title.ilike."%a,b%",body.ilike."%a,b%"',
    );
  });
});
