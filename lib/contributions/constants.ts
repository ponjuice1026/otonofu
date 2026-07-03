import type { ContributionKind, ContributionStatus } from "@/lib/types";

export const CONTRIBUTION_KINDS = [
  "add_artist",
  "add_album",
  "fix_data",
] as const;

export const CONTRIBUTION_STATUSES = [
  "pending",
  "approved",
  "rejected",
] as const;

export const CONTRIBUTION_KIND_LABELS: Record<ContributionKind, string> = {
  add_artist: "アーティストの追加",
  add_album: "アルバムの追加",
  fix_data: "情報の修正",
};

export const CONTRIBUTION_STATUS_LABELS: Record<ContributionStatus, string> = {
  pending: "確認待ち",
  approved: "承認済み",
  rejected: "却下",
};

export function isContributionKind(value: string): value is ContributionKind {
  return (CONTRIBUTION_KINDS as readonly string[]).includes(value);
}

export function isContributionStatus(
  value: string,
): value is ContributionStatus {
  return (CONTRIBUTION_STATUSES as readonly string[]).includes(value);
}

/** payload の各項目の日本語ラベル。表示順の定義も兼ねる。 */
export const CONTRIBUTION_PAYLOAD_LABELS: Record<string, string> = {
  name: "名前",
  reading: "読み（かな）",
  year: "発表年",
  label: "レーベル",
  artistName: "アーティスト名",
  tracklist: "トラックリスト",
  detail: "修正内容",
  note: "補足",
};
