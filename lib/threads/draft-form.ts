import type { PollOptionDraft } from "@/components/thread/PollOptionPicker";
import {
  DEFAULT_VIEW_ONLY_OPTION_LABEL,
  defaultPollOptionDrafts,
} from "@/lib/threads/poll-defaults";
import type { DbDiscussionPollOption } from "@/lib/supabase/types";

export type ThreadDraftFormData = {
  id: string;
  title: string;
  body: string;
  /** 紐付くカテゴリ（板）のID。未分類は null。 */
  categoryId: string | null;
  enablePoll: boolean;
  addViewOnlyOption: boolean;
  pollOptions: PollOptionDraft[];
};

export type ThreadDraftSummary = {
  id: string;
  title: string;
  updatedAt: string;
};

function ensureMinimumPollOptions(options: PollOptionDraft[]): PollOptionDraft[] {
  const base = [...options];
  while (base.length < 2) {
    base.push({ type: "text", label: "" });
  }
  return base;
}

export function pollOptionsToDrafts(options: DbDiscussionPollOption[]): {
  enablePoll: boolean;
  addViewOnlyOption: boolean;
  pollOptions: PollOptionDraft[];
} {
  if (options.length === 0) {
    return {
      enablePoll: false,
      addViewOnlyOption: false,
      pollOptions: defaultPollOptionDrafts(),
    };
  }

  let addViewOnlyOption = false;
  const pollOptions: PollOptionDraft[] = [];

  for (const option of options) {
    if (option.exclude_from_tally) {
      addViewOnlyOption = true;
      continue;
    }

    if (option.option_type === "album" && option.album_id) {
      pollOptions.push({
        type: "album",
        label: option.label,
        albumId: option.album_id,
      });
      continue;
    }

    if (option.option_type === "artist" && option.artist_id) {
      pollOptions.push({
        type: "artist",
        label: option.label,
        artistId: option.artist_id,
      });
      continue;
    }

    pollOptions.push({
      type: "text",
      label: option.label,
    });
  }

  return {
    enablePoll: pollOptions.length > 0 || addViewOnlyOption,
    addViewOnlyOption,
    pollOptions: ensureMinimumPollOptions(pollOptions),
  };
}
