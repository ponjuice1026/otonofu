import type { PollOptionDraft } from "@/components/thread/PollOptionPicker";
import type { PollOptionInput } from "@/lib/threads/validate";

export const DEFAULT_POLL_OPTION_LABELS = ["選択肢1", "選択肢2"] as const;

export const DEFAULT_VIEW_ONLY_OPTION_LABEL = "結果だけ見る（投票しない）";

export function defaultPollOptionDrafts(): PollOptionDraft[] {
  return DEFAULT_POLL_OPTION_LABELS.map((label) => ({
    type: "text",
    label,
  }));
}

export function buildViewOnlyPollOptionInput(): PollOptionInput {
  return {
    type: "text",
    label: DEFAULT_VIEW_ONLY_OPTION_LABEL,
    excludeFromTally: true,
  };
}

const SAMPLE_PERCENT_TEMPLATES: Record<number, number[]> = {
  2: [58, 42],
  3: [45, 32, 23],
  4: [38, 28, 21, 13],
  5: [32, 24, 19, 15, 10],
  6: [28, 22, 18, 14, 11, 7],
  7: [24, 20, 16, 14, 12, 9, 5],
  8: [22, 18, 15, 13, 11, 9, 7, 5],
};

export function sampleResultPercents(optionCount: number): number[] {
  const count = Math.min(Math.max(optionCount, 2), 8);
  const template = SAMPLE_PERCENT_TEMPLATES[count] ?? SAMPLE_PERCENT_TEMPLATES[2];
  return template.slice(0, optionCount);
}

export type PollResultPreviewRow = {
  label: string;
  voteCount: number;
  percent: number;
};

/** 作成フォーム用の結果プレビュー行（集計対象の選択肢のみ） */
export function buildPollResultPreviewRows(
  labels: string[],
): PollResultPreviewRow[] {
  const percents = sampleResultPercents(labels.length);
  const sampleTotal = 24;

  return labels.map((label, index) => {
    const percent = percents[index] ?? 0;
    return {
      label,
      percent,
      voteCount: Math.max(0, Math.round((percent / 100) * sampleTotal)),
    };
  });
}

export function serializePollOptionDraft(option: PollOptionDraft) {
  if (option.type === "album") {
    return {
      type: "album" as const,
      label: option.label,
      albumId: option.albumId,
    };
  }
  if (option.type === "artist") {
    return {
      type: "artist" as const,
      label: option.label,
      artistId: option.artistId,
    };
  }
  return {
    type: "text" as const,
    label: option.label,
  };
}

export function serializePollOptionDrafts(options: PollOptionDraft[]): string {
  return JSON.stringify(options.map(serializePollOptionDraft));
}
