"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export type AuthFormState = {
  error?: string;
  success?: string;
};

function getSiteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
}

function safeRedirectPath(value: FormDataEntryValue | null): string {
  const path = String(value ?? "").trim();
  if (!path.startsWith("/") || path.startsWith("//")) {
    return "/";
  }
  return path;
}

function ensureConfigured(): AuthFormState | null {
  if (!isSupabaseConfigured()) {
    return {
      error:
        "Supabase が未設定です。.env.local に URL とキーを設定してください。",
    };
  }
  return null;
}

export async function login(
  _prevState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const configError = ensureConfigured();
  if (configError) return configError;

  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "メールアドレスとパスワードを入力してください。" };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: translateAuthError(error.message) };
  }

  redirect(safeRedirectPath(formData.get("redirect")));
}

const DISPLAY_NAME_MAX = 24;

function normalizeDisplayName(value: FormDataEntryValue | null): string {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, DISPLAY_NAME_MAX);
}

export async function signup(
  _prevState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const configError = ensureConfigured();
  if (configError) return configError;

  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const displayName = normalizeDisplayName(formData.get("displayName"));

  if (!email || !password) {
    return { error: "メールアドレスとパスワードを入力してください。" };
  }

  if (!displayName) {
    return { error: "表示名を入力してください。" };
  }

  if (password.length < 6) {
    return { error: "パスワードは6文字以上にしてください。" };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${getSiteUrl()}/auth/callback`,
      data: { display_name: displayName },
    },
  });

  if (error) {
    return { error: translateAuthError(error.message) };
  }

  if (data.user) {
    await supabase
      .from("profiles")
      .update({ display_name: displayName })
      .eq("id", data.user.id);
  }

  return {
    success:
      "登録しました。確認メールが届いた場合はリンクをクリックしてからログインしてください。",
  };
}

export async function logout(): Promise<void> {
  if (!isSupabaseConfigured()) {
    redirect("/login");
  }

  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}

function translateAuthError(message: string): string {
  if (message.includes("Invalid login credentials")) {
    return "メールアドレスまたはパスワードが正しくありません。";
  }
  if (message.includes("Email not confirmed")) {
    return "メールアドレスの確認が完了していません。受信トレイを確認してください。";
  }
  if (message.includes("User already registered")) {
    return "このメールアドレスは既に登録されています。";
  }
  return message;
}
