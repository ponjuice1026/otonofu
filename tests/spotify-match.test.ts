import { describe, it, expect } from "vitest";
import {
  normalizeText,
  normalizeTitleForCompare,
  titleSimilarity,
  artistMatches,
  yearProximityScore,
  scoreCandidate,
  pickBestMatch,
  isHighConfidence,
  DEFAULT_MIN_SCORE,
  type MatchAlbumRow,
  type MatchCandidate,
} from "@/lib/spotify/match";

describe("normalizeText", () => {
  it("全角/半角・大小文字・記号を統一する", () => {
    expect(normalizeText("ＡＢＣ")).toBe("abc");
    expect(normalizeText("Hello, World!")).toBe(normalizeText("hello world"));
  });

  it("空文字/null/undefinedは空文字を返す", () => {
    expect(normalizeText("")).toBe("");
    expect(normalizeText(null)).toBe("");
    expect(normalizeText(undefined)).toBe("");
  });

  it("空白・中黒・波ダッシュ等を除去する", () => {
    expect(normalizeText("A・B〜C D")).toBe("abcd");
  });
});

describe("normalizeTitleForCompare", () => {
  it("feat.以降を除去する", () => {
    expect(normalizeTitleForCompare("Song Title feat. Someone")).toBe(
      normalizeTitleForCompare("Song Title"),
    );
  });

  it("featuringも除去する", () => {
    expect(normalizeTitleForCompare("Song Title featuring Someone Else")).toBe(
      normalizeTitleForCompare("Song Title"),
    );
  });

  it("(Remastered 2011)等の注記を除去する", () => {
    expect(normalizeTitleForCompare("アルバム名 (Remastered 2011)")).toBe(
      normalizeTitleForCompare("アルバム名"),
    );
  });

  it("Deluxe Editionの注記を除去する", () => {
    expect(normalizeTitleForCompare("Album Title (Deluxe Edition)")).toBe(
      normalizeTitleForCompare("Album Title"),
    );
  });
});

describe("titleSimilarity", () => {
  it("完全一致は1.0", () => {
    expect(titleSimilarity("同じタイトル", "同じタイトル")).toBe(1);
  });

  it("正規化後の完全一致（全角半角・大小差）も1.0", () => {
    expect(titleSimilarity("ＡＢＣ　Ｄｅｆ", "abc def")).toBe(1);
  });

  it("前方一致（十分な長さ）は高スコア", () => {
    const s = titleSimilarity("Wonderful World Tour", "Wonderful World");
    expect(s).toBeGreaterThanOrEqual(0.85);
  });

  it("全く異なるタイトルは低スコア", () => {
    const s = titleSimilarity("マツケンサンバ", "灼熱のマグマ大使");
    expect(s).toBeLessThan(0.4);
  });

  it("空文字は0", () => {
    expect(titleSimilarity("", "何か")).toBe(0);
    expect(titleSimilarity("何か", "")).toBe(0);
  });

  it("部分的に似ているタイトルは中間スコア", () => {
    const s = titleSimilarity("BEST ALBUM 2020", "BEST ALBUM 2021");
    expect(s).toBeGreaterThan(0.5);
    expect(s).toBeLessThan(1);
  });
});

describe("artistMatches", () => {
  it("完全一致でtrue", () => {
    expect(artistMatches(["米津玄師"], [{ name: "米津玄師" }])).toBe(true);
  });

  it("name_enでの一致でもtrue", () => {
    expect(
      artistMatches([null, "Kenshi Yonezu"], [{ name: "Kenshi Yonezu" }]),
    ).toBe(true);
  });

  it("別アーティストはfalse（誤マッチ防止の要）", () => {
    expect(artistMatches(["米津玄師"], [{ name: "back number" }])).toBe(false);
  });

  it("同名異表記アーティストの部分一致（十分な長さ）はtrue", () => {
    expect(
      artistMatches(["Mr.Children"], [{ name: "Mr children" }]),
    ).toBe(true);
  });

  it("DB側アーティスト名が空ならfalse", () => {
    expect(artistMatches([null, undefined], [{ name: "Someone" }])).toBe(false);
  });

  it("候補側アーティストが空配列ならfalse", () => {
    expect(artistMatches(["Someone"], [])).toBe(false);
  });

  it("短すぎる名前同士の部分一致では誤爆させない", () => {
    // 1文字同士の includes 一致を許すと誤爆しやすいため false
    expect(artistMatches(["a"], [{ name: "ab" }])).toBe(false);
  });
});

describe("yearProximityScore", () => {
  it("年が同じなら1.0", () => {
    expect(yearProximityScore(2020, "2020-05-01").score).toBe(1);
  });

  it("差1年は加点(0.7)", () => {
    expect(yearProximityScore(2020, "2021-01-01").score).toBe(0.7);
  });

  it("差2年は0.4", () => {
    expect(yearProximityScore(2020, "2022-01-01").score).toBe(0.4);
  });

  it("差3年は0.1", () => {
    expect(yearProximityScore(2020, "2023-01-01").score).toBe(0.1);
  });

  it("差4年以上は減点(マイナス)", () => {
    expect(yearProximityScore(2020, "2025-01-01").score).toBeLessThan(0);
  });

  it("DB側年がnullならunknown", () => {
    const r = yearProximityScore(null, "2020-01-01");
    expect(r.unknown).toBe(true);
  });

  it("release_dateが無ければunknown", () => {
    const r = yearProximityScore(2020, null);
    expect(r.unknown).toBe(true);
  });

  it("release_dateが年のみの表記でも解釈できる", () => {
    expect(yearProximityScore(2020, "2020").score).toBe(1);
  });
});

describe("scoreCandidate", () => {
  const baseAlbum: MatchAlbumRow = {
    id: "album-1",
    title: "OK Computer",
    artistName: "Radiohead",
    artistNameEn: null,
    year: 1997,
  };

  it("タイトル完全一致・アーティスト一致・年一致は高スコア", () => {
    const candidate: MatchCandidate = {
      id: "sp1",
      name: "OK Computer",
      releaseDate: "1997-06-16",
      artists: [{ id: "a1", name: "Radiohead" }],
    };
    const detail = scoreCandidate(baseAlbum, candidate);
    expect(detail.artistOk).toBe(true);
    expect(detail.score).toBeGreaterThanOrEqual(DEFAULT_MIN_SCORE);
  });

  it("アーティスト不一致は問答無用でスコア0（誤マッチ防止）", () => {
    const candidate: MatchCandidate = {
      id: "sp2",
      name: "OK Computer",
      releaseDate: "1997-06-16",
      artists: [{ id: "a2", name: "Some Other Band" }],
    };
    const detail = scoreCandidate(baseAlbum, candidate);
    expect(detail.artistOk).toBe(false);
    expect(detail.score).toBe(0);
  });

  it("タイトルが大きく異なる場合はアーティスト一致でもスコア0", () => {
    const candidate: MatchCandidate = {
      id: "sp3",
      name: "In Rainbows",
      releaseDate: "1997-06-16",
      artists: [{ id: "a1", name: "Radiohead" }],
    };
    const detail = scoreCandidate(baseAlbum, candidate);
    expect(detail.score).toBe(0);
  });

  it("年が大きくずれると減点され、他条件が強くないと閾値未満になる", () => {
    const near: MatchAlbumRow = { ...baseAlbum, title: "Best Album 2020" };
    const farYearCandidate: MatchCandidate = {
      id: "sp4",
      name: "Best Album 2021", // タイトルはやや似ているだけ
      releaseDate: "2035-01-01",
      artists: [{ id: "a1", name: "Radiohead" }],
    };
    const detail = scoreCandidate(near, farYearCandidate);
    expect(detail.score).toBeLessThan(DEFAULT_MIN_SCORE);
  });

  it("年情報が欠けていても、タイトル・アーティストが強ければそこそこのスコアになる", () => {
    const noYearAlbum: MatchAlbumRow = { ...baseAlbum, year: null };
    const candidate: MatchCandidate = {
      id: "sp5",
      name: "OK Computer",
      releaseDate: null,
      artists: [{ id: "a1", name: "Radiohead" }],
    };
    const detail = scoreCandidate(noYearAlbum, candidate);
    expect(detail.yearUnknown).toBe(true);
    expect(detail.score).toBeGreaterThan(0);
  });

  it("正規化揺れ（全角/半角・feat.）を吸収して一致と判定する", () => {
    const album: MatchAlbumRow = {
      id: "album-2",
      title: "ラブソング",
      artistName: "サザンオールスターズ",
      artistNameEn: null,
      year: 2010,
    };
    const candidate: MatchCandidate = {
      id: "sp6",
      name: "ラブソング　feat. ゲスト",
      releaseDate: "2010-03-01",
      artists: [{ id: "a1", name: "サザンオールスターズ" }],
    };
    const detail = scoreCandidate(album, candidate);
    expect(detail.titleScore).toBe(1);
    expect(detail.score).toBeGreaterThanOrEqual(DEFAULT_MIN_SCORE);
  });
});

describe("pickBestMatch", () => {
  const album: MatchAlbumRow = {
    id: "album-1",
    title: "Discovery",
    artistName: "Daft Punk",
    artistNameEn: null,
    year: 2001,
  };

  it("複数候補から最良の1件を選ぶ", () => {
    const candidates: MatchCandidate[] = [
      {
        id: "wrong-artist",
        name: "Discovery",
        releaseDate: "2001-03-12",
        artists: [{ id: "x", name: "Someone Else" }],
      },
      {
        id: "right",
        name: "Discovery",
        releaseDate: "2001-03-12",
        artists: [{ id: "y", name: "Daft Punk" }],
      },
    ];
    const result = pickBestMatch(album, candidates);
    expect(result?.candidate.id).toBe("right");
  });

  it("採用可能な候補が無ければnull", () => {
    const candidates: MatchCandidate[] = [
      {
        id: "wrong",
        name: "Random Mixtape",
        releaseDate: "2001-01-01",
        artists: [{ id: "z", name: "Nobody" }],
      },
    ];
    expect(pickBestMatch(album, candidates)).toBeNull();
  });

  it("候補が空配列ならnull", () => {
    expect(pickBestMatch(album, [])).toBeNull();
  });
});

describe("isHighConfidence", () => {
  it("閾値以上ならtrue", () => {
    expect(isHighConfidence(0.9, DEFAULT_MIN_SCORE)).toBe(true);
  });

  it("閾値未満ならfalse", () => {
    expect(isHighConfidence(0.5, DEFAULT_MIN_SCORE)).toBe(false);
  });

  it("ちょうど閾値ならtrue（境界値）", () => {
    expect(isHighConfidence(0.7, 0.7)).toBe(true);
  });
});
