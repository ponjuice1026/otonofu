"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { CACHE_TAGS } from "@/lib/cache/tags";
import { ensureProfile } from "@/lib/auth/profile";
import { getUser } from "@/lib/auth/session";
import { getAlbumById } from "@/lib/data/albums";
import {
  ALBUM_RATING_CRITERIA,
  averageCriteriaRatings,
  isValidRating,
} from "@/lib/ratings";
import { isMissingColumnError } from "@/lib/reviews/schema-errors";
import { syncReviewSession } from "@/lib/reviews/review-session";
import type { AlbumCriteriaRatings } from "@/lib/types";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { checkRateLimit, RATE_LIMIT_MESSAGE } from "@/lib/rate-limit";

export type RatingActionState = {
  error?: string;
  success?: string;
  threadId?: string;
};

function parseRating(value: FormDataEntryValue | null): number | null {
  const rating = Number(value);
  if (!Number.isFinite(rating) || !isValidRating(rating)) return null;
  return Math.round(rating);
}

function parseCriteriaRatings(formData: FormData): AlbumCriteriaRatings | null {
  const criteria = {} as AlbumCriteriaRatings;

  for (const { key, formField } of ALBUM_RATING_CRITERIA) {
    const value = parseRating(formData.get(formField));
    if (value === null) return null;
    criteria[key] = value;
  }

  return criteria;
}

function parseSessionOptOut(formData: FormData): boolean {
  return formData.get("createSession") !== "on";
}

async function requireUser() {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase が未設定です。");
  }

  const user = await getUser();
  if (!user) {
    throw new Error("ログインが必要です。");
  }

  const profile = await ensureProfile(user.id, user.email);
  if (!profile) {
    throw new Error("プロフィールの作成に失敗しました。");
  }

  return { user, profile };
}

export async function submitAlbumReview(
  _prev: RatingActionState,
  formData: FormData,
): Promise<RatingActionState> {
  try {
    const { user, profile } = await requireUser();

    const albumId = String(formData.get("albumId") ?? "");
    const criteria = parseCriteriaRatings(formData);
    const body = String(formData.get("body") ?? "").trim();
    const sessionOptOut = parseSessionOptOut(formData);

    if (!albumId) return { error: "アルバムが指定されていません。" };
    if (!criteria) {
      return {
        error:
          "歌詞・メロディ・演奏技術・雰囲気・完成度の5項目すべてを0〜10で評価してください。",
      };
    }

    const rating = averageCriteriaRatings(criteria);

    const album = await getAlbumById(albumId);
    if (!album) return { error: "アルバムが見つかりません。" };

    // レート制限（要ログインなので key はユーザー）。
    // 短時間の大量レビュー投稿（スパム・スコア操作）を抑止する。
    const allowed = await checkRateLimit("review");
    if (!allowed) return { error: RATE_LIMIT_MESSAGE };

    const supabase = await createClient();
    const now = new Date().toISOString();

    const { data: existing } = await supabase
      .from("reviews")
      .select("id")
      .eq("user_id", user.id)
      .eq("album_id", album.id)
      .maybeSingle();

    const reviewId = existing?.id ?? crypto.randomUUID();
    const reviewPayload = {
      rating,
      rating_lyrics: criteria.lyrics,
      rating_melody: criteria.melody,
      rating_performance: criteria.performance,
      rating_atmosphere: criteria.atmosphere,
      rating_completion: criteria.completion,
      body,
      album_title: album.title,
      artist_id: album.artistId,
      username: profile.display_name ?? profile.username,
      updated_at: now,
    };
    const reviewPayloadWithSession = {
      ...reviewPayload,
      session_opt_out: sessionOptOut,
    };

    let reviewSessionSchemaReady = true;

    if (existing) {
      let { error } = await supabase
        .from("reviews")
        .update(reviewPayloadWithSession)
        .eq("id", existing.id);

      if (error && isMissingColumnError(error.message, "session_opt_out")) {
        reviewSessionSchemaReady = false;
        ({ error } = await supabase
          .from("reviews")
          .update(reviewPayload)
          .eq("id", existing.id));
      }

      if (error) return { error: error.message };
    } else {
      let { error } = await supabase.from("reviews").insert({
        id: reviewId,
        album_id: album.id,
        user_id: user.id,
        created_at: now,
        ...reviewPayloadWithSession,
      });

      if (error && isMissingColumnError(error.message, "session_opt_out")) {
        reviewSessionSchemaReady = false;
        ({ error } = await supabase.from("reviews").insert({
          id: reviewId,
          album_id: album.id,
          user_id: user.id,
          created_at: now,
          ...reviewPayload,
        }));
      }

      if (error) return { error: error.message };
    }

    let threadId: string | null = null;

    if (reviewSessionSchemaReady) {
      const { threadId: syncedThreadId, error: sessionError } =
        await syncReviewSession(supabase, {
          reviewId,
          userId: user.id,
          albumId: album.id,
          albumTitle: album.title,
          body,
          rating,
          criteria,
          sessionOptOut,
        });

      if (
        sessionError &&
        !isMissingColumnError(sessionError, "review_id") &&
        !isMissingColumnError(sessionError, "album_id")
      ) {
        return { error: sessionError };
      }

      threadId = syncedThreadId;
    }

    revalidatePath(`/albums/${albumId}`);
    revalidatePath("/");
    revalidatePath("/charts");
    revalidateTag(CACHE_TAGS.albums, "max");
    revalidateTag(CACHE_TAGS.reviews, "max");
    revalidateTag(CACHE_TAGS.threads, "max");
    revalidatePath("/threads");
    if (threadId) {
      revalidatePath(`/threads/${threadId}`);
    }

    return {
      success: !reviewSessionSchemaReady
        ? "レビューを保存しました。（セッション連携は DB マイグレーション適用後に有効になります）"
        : sessionOptOut
          ? "レビューを保存しました。"
          : threadId
            ? "レビューを保存し、セッションを公開しました。"
            : "レビューを保存しました。",
      threadId: threadId ?? undefined,
    };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "保存に失敗しました。",
    };
  }
}

export async function submitTrackRating(
  _prev: RatingActionState,
  formData: FormData,
): Promise<RatingActionState> {
  try {
    const { user } = await requireUser();

    const albumId = String(formData.get("albumId") ?? "");
    const spotifyTrackId = String(formData.get("spotifyTrackId") ?? "");
    const trackNumber = Number(formData.get("trackNumber"));
    const trackName = String(formData.get("trackName") ?? "").trim();
    const rating = parseRating(formData.get("rating"));

    if (!albumId || !spotifyTrackId) {
      return { error: "曲情報が不足しています。" };
    }
    if (!trackName) return { error: "曲名が指定されていません。" };
    if (!Number.isFinite(trackNumber)) return { error: "トラック番号が不正です。" };
    if (rating === null) return { error: "評価は0〜10で選んでください。" };

    const album = await getAlbumById(albumId);
    if (!album) return { error: "アルバムが見つかりません。" };

    const supabase = await createClient();
    const { error } = await supabase.from("track_ratings").upsert(
      {
        user_id: user.id,
        album_id: album.id,
        spotify_track_id: spotifyTrackId,
        track_number: trackNumber,
        track_name: trackName,
        rating,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,album_id,spotify_track_id" },
    );

    if (error) return { error: error.message };

    revalidatePath(`/albums/${albumId}`);

    return { success: "曲の評価を保存しました。" };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "保存に失敗しました。",
    };
  }
}

export async function deleteAlbumReview(albumId: string): Promise<RatingActionState> {
  try {
    const { user } = await requireUser();
    const supabase = await createClient();

    const { error } = await supabase
      .from("reviews")
      .delete()
      .eq("user_id", user.id)
      .eq("album_id", albumId);

    if (error) return { error: error.message };

    revalidatePath(`/albums/${albumId}`);
    revalidatePath("/");
    revalidatePath("/charts");
    revalidateTag(CACHE_TAGS.albums, "max");
    revalidateTag(CACHE_TAGS.reviews, "max");
    revalidateTag(CACHE_TAGS.threads, "max");
    revalidatePath("/threads");

    return { success: "レビューを削除しました。" };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "削除に失敗しました。",
    };
  }
}
