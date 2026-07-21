"use server";

import {
  CONTACT_LIMITS,
  isContactCategory,
  type ContactCategory,
} from "@/lib/contact/constants";
import { getOrCreateVoterKey } from "@/lib/threads/voter";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export type ContactActionState = {
  error?: string;
  success?: string;
};

/** RFC を厳密に追わない実用的なメール形式チェック。 */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * submit_contact_message RPC が投げる英語の例外メッセージを
 * 日本語のエラー文言にマップする。
 */
function mapContactRpcError(message: string): string {
  const normalized = message.toLowerCase();

  if (normalized.includes("rate limit exceeded")) {
    return "送信が続いています。しばらく時間をおいてから再度お試しください。";
  }
  if (normalized.includes("too many urls")) {
    return "URL が多すぎます。数を減らして再度お試しください。";
  }
  if (normalized.includes("invalid email")) {
    return "メールアドレスの形式が正しくありません。";
  }
  if (normalized.includes("invalid body")) {
    return "お問い合わせ内容を10文字以上で入力してください。";
  }
  if (normalized.includes("invalid name")) {
    return "お名前を入力してください。";
  }
  if (normalized.includes("invalid category")) {
    return "お問い合わせの種類を選択してください。";
  }
  return "送信に失敗しました。時間をおいて再度お試しください。";
}

function cleanField(raw: FormDataEntryValue | null, max: number): string {
  return String(raw ?? "").trim().slice(0, max);
}

export async function submitContactMessage(
  _prev: ContactActionState,
  formData: FormData,
): Promise<ContactActionState> {
  if (!isSupabaseConfigured()) {
    return { error: "Supabase が未設定のため送信できません。" };
  }

  // ハニーポット。通常のユーザーには見えない欄が埋まっていれば bot とみなし、
  // 成功したように見せて破棄する。
  if (String(formData.get("website") ?? "").trim()) {
    return { success: "お問い合わせを受け付けました。" };
  }

  const categoryRaw = String(formData.get("category") ?? "").trim();
  if (!isContactCategory(categoryRaw)) {
    return { error: "お問い合わせの種類を選択してください。" };
  }
  const category: ContactCategory = categoryRaw;

  const name = cleanField(formData.get("name"), CONTACT_LIMITS.name);
  const email = cleanField(formData.get("email"), CONTACT_LIMITS.email);
  const body = cleanField(formData.get("body"), CONTACT_LIMITS.body);

  if (!name) return { error: "お名前を入力してください。" };
  if (!email) return { error: "メールアドレスを入力してください。" };
  if (!EMAIL_PATTERN.test(email)) {
    return { error: "メールアドレスの形式が正しくありません。" };
  }
  if (body.length < 10) {
    return { error: "お問い合わせ内容を10文字以上で入力してください。" };
  }

  // 挿入は security definer RPC 経由（DB 直叩きバイパス防止 / A-2）。
  // レート制限（contact: 3/時）と重複投稿チェックは RPC 内部で行う。
  // sender_id は RPC 内部で auth.uid() が使われる。
  const supabase = await createClient();
  const { error } = await supabase.rpc("submit_contact_message", {
    message_category: category,
    sender_name: name,
    sender_email: email,
    message_body: body,
    voter_key: await getOrCreateVoterKey(),
  });

  if (error) {
    console.error("[Supabase] submitContactMessage:", error.message);
    return { error: mapContactRpcError(error.message) };
  }

  return {
    success:
      "お問い合わせを受け付けました。原則として3営業日以内に、ご記入いただいたメールアドレス宛に返信いたします。",
  };
}
