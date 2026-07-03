import { describe, it, expect } from "vitest";
import { mapArtist, mapAlbum, mapReview } from "@/lib/data/mappers";
import type { DbAlbum, DbArtist, DbReview } from "@/lib/supabase/types";

function dbArtist(overrides: Partial<DbArtist> = {}): DbArtist {
  return {
    id: "ar1",
    name: "アーティスト",
    name_en: null,
    spotify_id: null,
    origin: "日本",
    active_from: 2000,
    active_to: null,
    genres: ["j-pop"],
    bio: "bio text",
    career: undefined,
    image_url: null,
    ...overrides,
  };
}

function dbAlbum(overrides: Partial<DbAlbum> = {}): DbAlbum {
  return {
    id: "al1",
    title: "タイトル",
    artist_id: "ar1",
    spotify_id: null,
    year: 2020,
    genre: "rock",
    release_type: "album",
    cover_color: "#123456",
    cover_url: null,
    tracks: null,
    avg_rating: 7.5,
    rating_count: 12,
    ...overrides,
  };
}

function dbReview(overrides: Partial<DbReview> = {}): DbReview {
  return {
    id: "rev1",
    album_id: "al1",
    album_title: "タイトル",
    artist_id: "ar1",
    user_id: null,
    username: "名無し",
    rating: 8,
    rating_lyrics: null,
    rating_melody: null,
    rating_performance: null,
    rating_atmosphere: null,
    rating_completion: null,
    body: "本文",
    created_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("mapArtist", () => {
  it("snake_caseをcamelCaseに変換する", () => {
    const result = mapArtist(dbArtist());
    expect(result.id).toBe("ar1");
    expect(result.origin).toBe("日本");
    expect(result.activeFrom).toBe(2000);
  });

  it("nullフィールドはundefinedに変換する", () => {
    const result = mapArtist(
      dbArtist({ name_en: null, spotify_id: null, active_to: null, image_url: null }),
    );
    expect(result.nameEn).toBeUndefined();
    expect(result.spotifyId).toBeUndefined();
    expect(result.activeTo).toBeUndefined();
    expect(result.imageUrl).toBeUndefined();
  });

  it("値があるnullableフィールドは保持する", () => {
    const result = mapArtist(
      dbArtist({ name_en: "Artist", spotify_id: "sp1", active_to: 2010, image_url: "http://img" }),
    );
    expect(result.nameEn).toBe("Artist");
    expect(result.spotifyId).toBe("sp1");
    expect(result.activeTo).toBe(2010);
    expect(result.imageUrl).toBe("http://img");
  });

  it("careerがundefinedなら空配列にフォールバックする", () => {
    const result = mapArtist(dbArtist({ career: undefined }));
    expect(result.career).toEqual([]);
  });

  it("careerがあれば保持する", () => {
    const career = [{ year: 2005, label: "デビュー" }];
    const result = mapArtist(dbArtist({ career }));
    expect(result.career).toEqual(career);
  });
});

describe("mapAlbum", () => {
  it("基本フィールドを変換する", () => {
    const result = mapAlbum(dbAlbum());
    expect(result.id).toBe("al1");
    expect(result.type).toBe("album"); // release_type -> type
    expect(result.coverColor).toBe("#123456");
    expect(result.ratingCount).toBe(12);
  });

  it("avg_ratingを数値に変換する（文字列でも）", () => {
    const result = mapAlbum(dbAlbum({ avg_rating: "7.5" as unknown as number }));
    expect(result.avgRating).toBe(7.5);
  });

  it("tracksがnullならundefined", () => {
    const result = mapAlbum(dbAlbum({ tracks: null }));
    expect(result.tracks).toBeUndefined();
  });

  it("空配列のtracksはundefined", () => {
    const result = mapAlbum(dbAlbum({ tracks: [] }));
    expect(result.tracks).toBeUndefined();
  });

  it("有効なtracksはパースして番号順にソートする", () => {
    const result = mapAlbum(
      dbAlbum({
        tracks: [
          { id: "t2", number: 2, name: "曲2", duration: "3:00" },
          { id: "t1", number: 1, name: "曲1", duration: "2:30" },
        ],
      }),
    );
    expect(result.tracks?.map((t) => t.id)).toEqual(["t1", "t2"]);
  });

  it("cover_urlがnullならundefined", () => {
    expect(mapAlbum(dbAlbum({ cover_url: null })).coverUrl).toBeUndefined();
  });
});

describe("mapReview", () => {
  it("基本フィールドを変換する", () => {
    const result = mapReview(dbReview());
    expect(result.id).toBe("rev1");
    expect(result.albumTitle).toBe("タイトル");
    expect(result.rating).toBe(8);
  });

  it("user_idがnullならundefined", () => {
    expect(mapReview(dbReview({ user_id: null })).userId).toBeUndefined();
  });

  it("user_idがあれば保持する", () => {
    expect(mapReview(dbReview({ user_id: "u1" })).userId).toBe("u1");
  });

  it("criteriaが1つでもnullならcriteriaRatingsはundefined", () => {
    const result = mapReview(
      dbReview({
        rating_lyrics: 8,
        rating_melody: 8,
        rating_performance: 8,
        rating_atmosphere: 8,
        rating_completion: null,
      }),
    );
    expect(result.criteriaRatings).toBeUndefined();
  });

  it("criteriaが全て揃えばcriteriaRatingsを構築する", () => {
    const result = mapReview(
      dbReview({
        rating_lyrics: 1,
        rating_melody: 2,
        rating_performance: 3,
        rating_atmosphere: 4,
        rating_completion: 5,
      }),
    );
    expect(result.criteriaRatings).toEqual({
      lyrics: 1,
      melody: 2,
      performance: 3,
      atmosphere: 4,
      completion: 5,
    });
  });

  it("session_opt_outがundefinedならfalseにフォールバックする", () => {
    expect(mapReview(dbReview({ session_opt_out: undefined })).sessionOptOut).toBe(
      false,
    );
  });
});
