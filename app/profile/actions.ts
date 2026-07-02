"use server";

import { revalidatePath } from "next/cache";
import { ensureProfile } from "@/lib/auth/profile";
import { getUser } from "@/lib/auth/session";
import {
  normalizeBio,
  normalizeDisplayName,
  normalizeUsername,
  validateBio,
  validateDisplayName,
  validateUsername,
} from "@/lib/profile/validate";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export type ProfileActionState = {
  error?: string;
  success?: string;
};

export async function updateProfile(
  _prev: ProfileActionState,
  formData: FormData,
): Promise<ProfileActionState> {
  if (!isSupabaseConfigured()) {
    return { error: "Supabase が未設定です。" };
  }

  const user = await getUser();
  if (!user) return { error: "ログインが必要です。" };

  await ensureProfile(user.id, user.email);

  const displayNameRaw = String(formData.get("displayName") ?? "");
  const usernameRaw = String(formData.get("username") ?? "");
  const bioRaw = String(formData.get("bio") ?? "");

  const displayError = validateDisplayName(displayNameRaw);
  if (displayError) return { error: displayError };

  const usernameError = validateUsername(usernameRaw);
  if (usernameError) return { error: usernameError };

  const bioError = validateBio(bioRaw);
  if (bioError) return { error: bioError };

  const displayName = normalizeDisplayName(displayNameRaw);
  const username = normalizeUsername(usernameRaw);
  const bio = normalizeBio(bioRaw);

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ username, display_name: displayName, bio })
    .eq("id", user.id);

  if (error) {
    if (error.code === "23505" || /duplicate|unique/i.test(error.message)) {
      return { error: "このユーザー名は既に使われています。" };
    }
    return { error: error.message };
  }

  revalidatePath("/profile");
  revalidatePath("/admin");
  revalidatePath("/threads");
  return { success: "プロフィールを更新しました。" };
}

const AVATAR_MAX_BYTES = 2 * 1024 * 1024;
const AVATAR_MIME_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
]);

export type AvatarActionState = {
  error?: string;
  success?: string;
  avatarUrl?: string;
};

export async function uploadAvatar(
  _prev: AvatarActionState,
  formData: FormData,
): Promise<AvatarActionState> {
  if (!isSupabaseConfigured()) {
    return { error: "Supabase が未設定です。" };
  }

  const user = await getUser();
  if (!user) return { error: "ログインが必要です。" };

  const file = formData.get("avatar");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "画像を選択してください。" };
  }
  if (file.size > AVATAR_MAX_BYTES) {
    return { error: "ファイルサイズは 2MB 以下にしてください。" };
  }
  if (!AVATAR_MIME_TYPES.has(file.type)) {
    return { error: "PNG / JPEG / WebP / GIF のいずれかを選択してください。" };
  }

  const ext =
    file.type === "image/png"
      ? "png"
      : file.type === "image/jpeg"
        ? "jpg"
        : file.type === "image/webp"
          ? "webp"
          : "gif";

  const supabase = await createClient();
  const objectPath = `${user.id}/avatar.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from("avatars")
    .upload(objectPath, file, { upsert: true, contentType: file.type });

  if (uploadError) {
    return { error: `アップロードに失敗しました: ${uploadError.message}` };
  }

  const { data: publicUrlData } = supabase.storage
    .from("avatars")
    .getPublicUrl(objectPath);

  const publicUrl = `${publicUrlData.publicUrl}?v=${Date.now()}`;

  const { error: updateError } = await supabase
    .from("profiles")
    .update({ avatar_url: publicUrl })
    .eq("id", user.id);

  if (updateError) {
    return { error: updateError.message };
  }

  revalidatePath("/profile");
  revalidatePath("/admin");
  revalidatePath("/threads");
  return { success: "アバターを更新しました。", avatarUrl: publicUrl };
}

export async function removeAvatar(): Promise<AvatarActionState> {
  if (!isSupabaseConfigured()) {
    return { error: "Supabase が未設定です。" };
  }

  const user = await getUser();
  if (!user) return { error: "ログインが必要です。" };

  const supabase = await createClient();

  await supabase.storage
    .from("avatars")
    .remove([
      `${user.id}/avatar.png`,
      `${user.id}/avatar.jpg`,
      `${user.id}/avatar.webp`,
      `${user.id}/avatar.gif`,
    ]);

  const { error } = await supabase
    .from("profiles")
    .update({ avatar_url: null })
    .eq("id", user.id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/profile");
  revalidatePath("/admin");
  revalidatePath("/threads");
  return { success: "アバターを削除しました。" };
}
