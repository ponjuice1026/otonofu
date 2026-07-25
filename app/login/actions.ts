"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export type AuthFormState = {
  error?: string;
  success?: string;
};

// パスワード再設定などのメールに埋め込む URL の生成元。
//
// セキュリティ: x-forwarded-host は攻撃者が改ざん可能なため、
// これを無条件に信頼するとリセットリンクを攻撃者ドメインに向けられる
// （Host ヘッダ注入によるアカウント乗っ取り）。
// そのため本番では必ず信頼できる固定値 NEXT_PUBLIC_SITE_URL を最優先で使う。
// 未設定の場合（主にローカル開発）のみ、従来どおりリクエストヘッダから
// 組み立てるフォールバックを使う。本番では必ず環境変数を設定すること。
async function getSiteUrl(): Promise<string> {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (configured) {
    return configured.replace(/\/+$/, "");
  }

  // 開発用フォールバック（NEXT_PUBLIC_SITE_URL 未設定時のみ）。
  try {
    const h = await headers();
    const host = h.get("x-forwarded-host") ?? h.get("host");
    if (host) {
      const proto =
        h.get("x-forwarded-proto") ??
        (host.startsWith("localhost") ? "http" : "https");
      return `${proto}://${host}`;
    }
  } catch {
    // headers() が使えない文脈では localhost にフォールバック
  }
  return "http://localhost:3000";
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

/**
 * Google アカウントでのログイン / 新規登録。
 *
 * signInWithOAuth は Google の同意画面 URL を返すだけで、Cookie の確立は
 * リダイレクト後の /auth/callback（exchangeCodeForSession）で行われる。
 * 成功後の遷移先は callback の `next` に載せる。
 *
 * 事前設定（Supabase ダッシュボード）:
 *   Authentication → Providers → Google を有効化し、Google Cloud Console で
 *   発行した Client ID / Secret を登録する。承認済みリダイレクト URI には
 *   `<SUPABASE_URL>/auth/v1/callback` を、Supabase の Redirect URLs には
 *   本番 `${NEXT_PUBLIC_SITE_URL}/auth/callback` を許可すること。
 */
export async function signInWithGoogle(
  _prevState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const configError = ensureConfigured();
  if (configError) return configError;

  const next = safeRedirectPath(formData.get("redirect"));
  const redirectTo = `${await getSiteUrl()}/auth/callback?next=${encodeURIComponent(next)}`;

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo },
  });

  if (error || !data.url) {
    return { error: translateAuthError(error?.message ?? "google_oauth") };
  }

  // Google の同意画面へ遷移する（以降は /auth/callback が処理）。
  redirect(data.url);
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
      emailRedirectTo: `${await getSiteUrl()}/auth/callback`,
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

export async function requestPasswordReset(
  _prevState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const configError = ensureConfigured();
  if (configError) return configError;

  const email = String(formData.get("email") ?? "").trim();

  if (!email) {
    return { error: "メールアドレスを入力してください。" };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${await getSiteUrl()}/auth/callback?next=/auth/reset`,
  });

  if (error) {
    return { error: translateAuthError(error.message) };
  }

  // メールの存在有無を漏らさないよう、常に成功メッセージを返す
  return {
    success:
      "パスワード再設定用のメールを送信しました。届いたメールのリンクを開いて再設定してください。",
  };
}

export async function updatePassword(
  _prevState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const configError = ensureConfigured();
  if (configError) return configError;

  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirmPassword") ?? "");

  if (!password) {
    return { error: "新しいパスワードを入力してください。" };
  }

  if (password.length < 6) {
    return { error: "パスワードは6文字以上にしてください。" };
  }

  if (password !== confirm) {
    return { error: "パスワードが一致しません。" };
  }

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      error:
        "再設定リンクの有効期限が切れているか、無効です。もう一度メールを送信してください。",
    };
  }

  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    return { error: translateAuthError(error.message) };
  }

  return { success: "パスワードを変更しました。新しいパスワードでログインできます。" };
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
  if (message.includes("should be different from the old password")) {
    return "現在と異なる新しいパスワードを設定してください。";
  }
  if (message.includes("Password should be at least")) {
    return "パスワードは6文字以上にしてください。";
  }
  if (message.toLowerCase().includes("rate limit")) {
    return "リクエストが多すぎます。しばらくしてから再度お試しください。";
  }
  if (
    message.includes("google_oauth") ||
    message.toLowerCase().includes("provider is not enabled")
  ) {
    return "Google ログインを利用できません。時間をおいて再度お試しください。";
  }
  return message;
}
