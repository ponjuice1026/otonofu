import type { DbContactCategory } from "@/lib/supabase/types";

export type ContactCategory = DbContactCategory;

export const CONTACT_CATEGORY_LABELS: Record<ContactCategory, string> = {
  question: "サービスの使い方について",
  bug: "不具合の報告",
  request: "機能のご要望",
  data: "作品データの誤り・削除依頼",
  report: "権利侵害・違反投稿の申し立て",
  business: "取材・提携などのご相談",
  other: "その他",
};

export const CONTACT_CATEGORIES = Object.keys(
  CONTACT_CATEGORY_LABELS,
) as ContactCategory[];

export function isContactCategory(value: string): value is ContactCategory {
  return (CONTACT_CATEGORIES as string[]).includes(value);
}

/** 入力欄の上限。DB 側に制約はないためアプリ側で切り詰める。 */
export const CONTACT_LIMITS = {
  name: 100,
  email: 254,
  body: 4000,
} as const;
