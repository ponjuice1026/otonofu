import { describe, it, expect } from "vitest";
import {
  parseRankingPeriod,
  parseRankingSort,
  parseRankingCategory,
  resolveRankingCategory,
  matchesRankingCategory,
  rankingPeriodLabel,
  rankingSortLabel,
  rankingCategoryLabel,
  albumsPageHref,
  chartsPageHref,
  rankingPageHref,
  rankingPeriodSince,
  type ArtistRankingMeta,
} from "@/lib/albums/ranking-filters";
import type { Album } from "@/lib/types";

function album(genre: string): Album {
  return {
    id: "al1",
    title: "T",
    artistId: "ar1",
    year: 2020,
    genre,
    type: "album",
    coverColor: "#000",
    avgRating: 8,
    ratingCount: 10,
  };
}

const artist = (
  origin: string,
  genres: string[] = [],
): ArtistRankingMeta => ({ origin, genres });

describe("parseRankingPeriod", () => {
  it("weekはそのまま", () => {
    expect(parseRankingPeriod("week")).toBe("week");
  });
  it("monthはそのまま", () => {
    expect(parseRankingPeriod("month")).toBe("month");
  });
  it("yearはmonthにマッピング", () => {
    expect(parseRankingPeriod("year")).toBe("month");
  });
  it("undefinedはall", () => {
    expect(parseRankingPeriod(undefined)).toBe("all");
  });
  it("未知の値はall", () => {
    expect(parseRankingPeriod("xyz")).toBe("all");
  });
});

describe("parseRankingSort", () => {
  it("reviewsはそのまま", () => {
    expect(parseRankingSort("reviews")).toBe("reviews");
  });
  it("それ以外はrating", () => {
    expect(parseRankingSort("rating")).toBe("rating");
    expect(parseRankingSort(undefined)).toBe("rating");
    expect(parseRankingSort("foo")).toBe("rating");
  });
});

describe("parseRankingCategory", () => {
  it("既知のカテゴリはそのまま", () => {
    expect(parseRankingCategory("japanese")).toBe("japanese");
    expect(parseRankingCategory("western")).toBe("western");
    expect(parseRankingCategory("classical")).toBe("classical");
    expect(parseRankingCategory("jazz")).toBe("jazz");
  });
  it("未知の値はall", () => {
    expect(parseRankingCategory("pop")).toBe("all");
    expect(parseRankingCategory(undefined)).toBe("all");
  });
});

describe("resolveRankingCategory", () => {
  it("classicalジャンルをclassicalに分類", () => {
    expect(resolveRankingCategory(album("Classical"), undefined)).toBe(
      "classical",
    );
  });

  it("jazzジャンルをjazzに分類", () => {
    expect(resolveRankingCategory(album("Jazz"), undefined)).toBe("jazz");
  });

  it("classicalはjazzより優先される", () => {
    // blob に classical と jazz 両方 → classical が先に判定される
    expect(
      resolveRankingCategory(album("classical jazz"), undefined),
    ).toBe("classical");
  });

  it("originが日本ならjapanese", () => {
    expect(resolveRankingCategory(album("pop"), artist("日本"))).toBe(
      "japanese",
    );
  });

  it("originがJapan(英語)ならjapanese", () => {
    expect(resolveRankingCategory(album("pop"), artist("Japan"))).toBe(
      "japanese",
    );
  });

  it("j-popジャンルはjapanese", () => {
    expect(resolveRankingCategory(album("J-Pop"), artist("USA"))).toBe(
      "japanese",
    );
  });

  it("該当なしはwestern", () => {
    expect(resolveRankingCategory(album("rock"), artist("USA"))).toBe(
      "western",
    );
  });
});

describe("matchesRankingCategory", () => {
  it("allは常にtrue", () => {
    expect(matchesRankingCategory(album("rock"), undefined, "all")).toBe(true);
  });

  it("一致するカテゴリはtrue", () => {
    expect(matchesRankingCategory(album("Jazz"), undefined, "jazz")).toBe(true);
  });

  it("一致しないカテゴリはfalse", () => {
    expect(matchesRankingCategory(album("Jazz"), undefined, "classical")).toBe(
      false,
    );
  });
});

describe("ラベル取得", () => {
  it("rankingPeriodLabel", () => {
    expect(rankingPeriodLabel("week")).toBe("1週間");
    expect(rankingPeriodLabel("all")).toBe("全期間");
  });
  it("rankingSortLabel", () => {
    expect(rankingSortLabel("reviews")).toBe("レビュー数順");
    expect(rankingSortLabel("rating")).toBe("評価順");
  });
  it("rankingCategoryLabel", () => {
    expect(rankingCategoryLabel("japanese")).toBe("邦楽");
    expect(rankingCategoryLabel("all")).toBe("すべて");
  });
});

describe("rankingPageHref", () => {
  it("全てデフォルトならbasePathのみ", () => {
    expect(rankingPageHref("/albums", {})).toBe("/albums");
  });

  it("page>1のときpageクエリを付ける(/albumsのみ)", () => {
    expect(rankingPageHref("/albums", { page: 3 })).toBe("/albums?page=3");
  });

  it("page=1はクエリを付けない", () => {
    expect(rankingPageHref("/albums", { page: 1 })).toBe("/albums");
  });

  it("/chartsはpageを無視する", () => {
    expect(rankingPageHref("/charts", { page: 3 })).toBe("/charts");
  });

  it("非デフォルトのperiod/category/sortを付ける", () => {
    expect(
      rankingPageHref("/albums", {
        period: "week",
        category: "japanese",
        sort: "reviews",
      }),
    ).toBe("/albums?period=week&category=japanese&sort=reviews");
  });

  it("デフォルト値(all/rating)はクエリに含めない", () => {
    expect(
      rankingPageHref("/albums", { period: "all", category: "all", sort: "rating" }),
    ).toBe("/albums");
  });

  it("hashを付与する", () => {
    expect(rankingPageHref("/albums", { hash: "top" })).toBe("/albums#top");
  });

  it("クエリとhashを両方付与する", () => {
    expect(rankingPageHref("/albums", { period: "week", hash: "top" })).toBe(
      "/albums?period=week#top",
    );
  });
});

describe("albumsPageHref / chartsPageHref", () => {
  it("albumsPageHrefは/albumsを使う", () => {
    expect(albumsPageHref({ period: "month" })).toBe("/albums?period=month");
  });
  it("chartsPageHrefは/chartsを使う", () => {
    expect(chartsPageHref({ sort: "reviews" })).toBe("/charts?sort=reviews");
  });
});

describe("rankingPeriodSince", () => {
  it("weekは約7日前", () => {
    const now = Date.now();
    const since = rankingPeriodSince("week").getTime();
    const diffDays = Math.round((now - since) / (24 * 60 * 60 * 1000));
    expect(diffDays).toBe(7);
  });

  it("monthは約30日前", () => {
    const now = Date.now();
    const since = rankingPeriodSince("month").getTime();
    const diffDays = Math.round((now - since) / (24 * 60 * 60 * 1000));
    expect(diffDays).toBe(30);
  });
});
