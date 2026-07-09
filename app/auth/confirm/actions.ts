"use server";

import { redirect } from "next/navigation";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

// メール確認は必ずこのアクション（ユーザーのボタン押下 = POST）で実行する。
// メールのセキュリティスキャナはリンクを GET で先読みするが、
// フォーム送信はしないため、ワンタイムトークンが先に消費されるのを防げる。
export async function confirmEmailAction(formData: FormData) {
  const tokenHash = String(formData.get("token_hash") ?? "");
  const type = String(formData.get("type") ?? "") as EmailOtpType;
  const nextRaw = String(formData.get("next") ?? "/");
  const next =
    nextRaw.startsWith("/") && !nextRaw.startsWith("//") ? nextRaw : "/";

  if (!tokenHash || !type) {
    redirect("/login?error=auth_callback");
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({
    type,
    token_hash: tokenHash,
  });

  if (error) {
    redirect("/login?error=auth_callback");
  }

  redirect(next);
}
