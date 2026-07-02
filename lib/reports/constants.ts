export const CONTENT_REPORT_TARGET_TYPES = [
  "discussion_post",
  "review",
  "review_comment",
] as const;

export type ContentReportTargetType =
  (typeof CONTENT_REPORT_TARGET_TYPES)[number];

export const CONTENT_REPORT_REASONS = [
  "spam",
  "harassment",
  "inappropriate",
  "other",
] as const;

export type ContentReportReason = (typeof CONTENT_REPORT_REASONS)[number];

export const CONTENT_REPORT_REASON_LABELS: Record<
  ContentReportReason,
  string
> = {
  spam: "スパム・宣伝",
  harassment: "嫌がらせ・誹謗中傷",
  inappropriate: "不適切な内容",
  other: "その他",
};

export const CONTENT_REPORT_TARGET_LABELS: Record<
  ContentReportTargetType,
  string
> = {
  discussion_post: "セッションコメント",
  review: "レビュー",
  review_comment: "レビューコメント",
};

export function isContentReportTargetType(
  value: string,
): value is ContentReportTargetType {
  return (CONTENT_REPORT_TARGET_TYPES as readonly string[]).includes(value);
}

export function isContentReportReason(
  value: string,
): value is ContentReportReason {
  return (CONTENT_REPORT_REASONS as readonly string[]).includes(value);
}

export function getReportReasonOptions(): {
  value: ContentReportReason;
  label: string;
}[] {
  return CONTENT_REPORT_REASONS.map((value) => ({
    value,
    label: CONTENT_REPORT_REASON_LABELS[value],
  }));
}
