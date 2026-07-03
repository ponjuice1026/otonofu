"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ensureProfile } from "@/lib/auth/profile";
import { getUser } from "@/lib/auth/session";
import { getAlbumById } from "@/lib/data/albums";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import type { DbUserList, DbUserListItem } from "@/lib/supabase/types";
import { checkRateLimit, RATE_LIMIT_MESSAGE } from "@/lib/rate-limit";
import { checkContent } from "@/lib/moderation";

export type ListActionState = {
  error?: string;
  success?: string;
};

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

/** リスト作成 → 成功時 /lists/[id] へリダイレクト */
export async function createList(
  _prev: ListActionState,
  formData: FormData,
): Promise<ListActionState> {
  let newListId: string | null = null;
  try {
    const { user } = await requireUser();

    const title = String(formData.get("title") ?? "").trim();
    const description = String(formData.get("description") ?? "").trim();
    const isPublic = formData.get("isPublic") === "on";

    if (title.length < 1 || title.length > 100) {
      return { error: "タイトルは1〜100文字で入力してください。" };
    }
    if (description.length > 2000) {
      return { error: "説明は2000文字以内で入力してください。" };
    }

    const moderationError = checkContent(`${title}\n${description}`);
    if (moderationError) return { error: moderationError };

    const allowed = await checkRateLimit("list_create", { dedupBody: title });
    if (!allowed) return { error: RATE_LIMIT_MESSAGE };

    const supabase = await createClient();
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from("user_lists")
      .insert({
        author_id: user.id,
        title,
        description: description || null,
        is_public: isPublic,
        created_at: now,
        updated_at: now,
      })
      .select("id")
      .single();

    if (error || !data) {
      return { error: error?.message ?? "リストの作成に失敗しました。" };
    }

    newListId = (data as { id: string }).id;
  } catch (err) {
    return { error: err instanceof Error ? err.message : "作成に失敗しました。" };
  }

  revalidatePath("/lists");
  redirect(`/lists/${newListId}`);
}

async function assertListOwner(
  listId: string,
  userId: string,
): Promise<DbUserList | { error: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("user_lists")
    .select("*")
    .eq("id", listId)
    .maybeSingle();

  if (error || !data) return { error: "リストが見つかりません。" };
  const row = data as DbUserList;
  if (row.author_id !== userId) return { error: "権限がありません。" };
  return row;
}

/** リストのメタ情報（タイトル・説明・公開設定）を更新 */
export async function updateList(
  _prev: ListActionState,
  formData: FormData,
): Promise<ListActionState> {
  try {
    const { user } = await requireUser();
    const listId = String(formData.get("listId") ?? "");
    if (!listId) return { error: "リストが指定されていません。" };

    const owner = await assertListOwner(listId, user.id);
    if ("error" in owner) return { error: owner.error };

    const title = String(formData.get("title") ?? "").trim();
    const description = String(formData.get("description") ?? "").trim();
    const isPublic = formData.get("isPublic") === "on";

    if (title.length < 1 || title.length > 100) {
      return { error: "タイトルは1〜100文字で入力してください。" };
    }
    if (description.length > 2000) {
      return { error: "説明は2000文字以内で入力してください。" };
    }

    const supabase = await createClient();
    const { error } = await supabase
      .from("user_lists")
      .update({
        title,
        description: description || null,
        is_public: isPublic,
        updated_at: new Date().toISOString(),
      })
      .eq("id", listId);

    if (error) return { error: error.message };

    revalidatePath(`/lists/${listId}`);
    revalidatePath("/lists");
    return { success: "リストを更新しました。" };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "更新に失敗しました。" };
  }
}

/** リスト削除 → /lists へリダイレクト */
export async function deleteList(
  _prev: ListActionState,
  formData: FormData,
): Promise<ListActionState> {
  try {
    const { user } = await requireUser();
    const listId = String(formData.get("listId") ?? "");
    if (!listId) return { error: "リストが指定されていません。" };

    const owner = await assertListOwner(listId, user.id);
    if ("error" in owner) return { error: owner.error };

    const supabase = await createClient();
    const { error } = await supabase
      .from("user_lists")
      .delete()
      .eq("id", listId);

    if (error) return { error: error.message };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "削除に失敗しました。" };
  }

  revalidatePath("/lists");
  redirect("/lists");
}

/**
 * リストにアルバムを追加。position は末尾に配置。
 * albumId の重複は unique 制約で弾かれるため、事前チェックして分かりやすいエラーにする。
 */
export async function addAlbumToList(
  _prev: ListActionState,
  formData: FormData,
): Promise<ListActionState> {
  try {
    const { user } = await requireUser();
    const listId = String(formData.get("listId") ?? "");
    const albumId = String(formData.get("albumId") ?? "");
    const note = String(formData.get("note") ?? "").trim();

    if (!listId || !albumId) {
      return { error: "リストまたはアルバムが指定されていません。" };
    }
    if (note.length > 500) {
      return { error: "一言メモは500文字以内で入力してください。" };
    }

    const owner = await assertListOwner(listId, user.id);
    if ("error" in owner) return { error: owner.error };

    const album = await getAlbumById(albumId);
    if (!album) return { error: "アルバムが見つかりません。" };

    const supabase = await createClient();

    const { data: existing } = await supabase
      .from("user_list_items")
      .select("id")
      .eq("list_id", listId)
      .eq("album_id", albumId)
      .maybeSingle();

    if (existing) {
      return { error: "このアルバムは既にリストに含まれています。" };
    }

    const { data: maxRow } = await supabase
      .from("user_list_items")
      .select("position")
      .eq("list_id", listId)
      .order("position", { ascending: false })
      .limit(1)
      .maybeSingle();

    const nextPosition =
      maxRow && typeof maxRow.position === "number" ? maxRow.position + 1 : 0;

    const { error } = await supabase.from("user_list_items").insert({
      list_id: listId,
      album_id: albumId,
      position: nextPosition,
      note: note || null,
    });

    if (error) return { error: error.message };

    await touchList(listId);
    revalidatePath(`/lists/${listId}`);
    revalidatePath("/lists");
    revalidatePath(`/albums/${albumId}`);
    return { success: `「${album.title}」を追加しました。` };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "追加に失敗しました。" };
  }
}

/** リストからアルバムを削除 */
export async function removeAlbumFromList(
  _prev: ListActionState,
  formData: FormData,
): Promise<ListActionState> {
  try {
    const { user } = await requireUser();
    const listId = String(formData.get("listId") ?? "");
    const itemId = String(formData.get("itemId") ?? "");
    if (!listId || !itemId) {
      return { error: "項目が指定されていません。" };
    }

    const owner = await assertListOwner(listId, user.id);
    if ("error" in owner) return { error: owner.error };

    const supabase = await createClient();
    const { error } = await supabase
      .from("user_list_items")
      .delete()
      .eq("id", itemId)
      .eq("list_id", listId);

    if (error) return { error: error.message };

    await touchList(listId);
    revalidatePath(`/lists/${listId}`);
    revalidatePath("/lists");
    return { success: "リストから削除しました。" };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "削除に失敗しました。" };
  }
}

/**
 * 項目の並び替え（上/下ボタン）。
 * direction: "up" | "down"。隣接する項目と position を入れ替える。
 */
export async function moveListItem(
  _prev: ListActionState,
  formData: FormData,
): Promise<ListActionState> {
  try {
    const { user } = await requireUser();
    const listId = String(formData.get("listId") ?? "");
    const itemId = String(formData.get("itemId") ?? "");
    const direction = String(formData.get("direction") ?? "");
    if (!listId || !itemId || (direction !== "up" && direction !== "down")) {
      return { error: "並び替えの指定が不正です。" };
    }

    const owner = await assertListOwner(listId, user.id);
    if ("error" in owner) return { error: owner.error };

    const supabase = await createClient();
    const { data: items } = await supabase
      .from("user_list_items")
      .select("id, position")
      .eq("list_id", listId)
      .order("position", { ascending: true });

    const ordered = (items ?? []) as Pick<DbUserListItem, "id" | "position">[];
    const index = ordered.findIndex((item) => item.id === itemId);
    if (index === -1) return { error: "項目が見つかりません。" };

    const swapIndex = direction === "up" ? index - 1 : index + 1;
    if (swapIndex < 0 || swapIndex >= ordered.length) {
      return { success: "これ以上移動できません。" };
    }

    const current = ordered[index];
    const target = ordered[swapIndex];

    // position を入れ替え。unique(list_id, album_id) には触れないので衝突しない。
    const { error: e1 } = await supabase
      .from("user_list_items")
      .update({ position: target.position })
      .eq("id", current.id);
    const { error: e2 } = await supabase
      .from("user_list_items")
      .update({ position: current.position })
      .eq("id", target.id);

    if (e1 || e2) return { error: (e1 ?? e2)?.message };

    await touchList(listId);
    revalidatePath(`/lists/${listId}`);
    return { success: "並び替えました。" };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "並び替えに失敗しました。",
    };
  }
}

async function touchList(listId: string): Promise<void> {
  try {
    const supabase = await createClient();
    await supabase
      .from("user_lists")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", listId);
  } catch {
    // updated_at 更新の失敗は本処理を止めない
  }
}
