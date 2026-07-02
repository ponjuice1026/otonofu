"use client";

import Link from "next/link";
import { useActionState, useMemo, useState } from "react";
import {
  saveDiscussionThread,
  type ThreadActionState,
} from "@/app/threads/actions";
import {
  PollOptionPicker,
  type PollOptionDraft,
} from "@/components/thread/PollOptionPicker";
import { PollResultPreview } from "@/components/thread/PollResults";
import type { ThreadDraftFormData } from "@/lib/threads/draft-form";
import {
  buildPollResultPreviewRows,
  defaultPollOptionDrafts,
  DEFAULT_VIEW_ONLY_OPTION_LABEL,
  serializePollOptionDrafts,
} from "@/lib/threads/poll-defaults";
import { POLL_OPTION_MAX_COUNT } from "@/lib/threads/validate";

const initialState: ThreadActionState = {};

type CreateThreadFormProps = {
  draft?: ThreadDraftFormData | null;
  showSavedMessage?: boolean;
};

export function CreateThreadForm({
  draft = null,
  showSavedMessage = false,
}: CreateThreadFormProps) {
  const [state, formAction, pending] = useActionState(
    saveDiscussionThread,
    initialState,
  );
  const [enablePoll, setEnablePoll] = useState(draft?.enablePoll ?? false);
  const [addViewOnlyOption, setAddViewOnlyOption] = useState(
    draft?.addViewOnlyOption ?? false,
  );
  const [pollOptions, setPollOptions] = useState<PollOptionDraft[]>(
    draft?.pollOptions ?? defaultPollOptionDrafts(),
  );

  const serialized = useMemo(
    () => serializePollOptionDrafts(pollOptions),
    [pollOptions],
  );

  const previewRows = useMemo(() => {
    const labels = pollOptions
      .map((option) => option.label.trim())
      .filter(Boolean);
    return buildPollResultPreviewRows(labels).map((row, index) => ({
      id: `preview-${index}`,
      ...row,
    }));
  }, [pollOptions]);

  const viewOnlySlotAvailable =
    pollOptions.length < POLL_OPTION_MAX_COUNT;

  function emptyText(): PollOptionDraft {
    return { type: "text", label: "" };
  }

  function updateOption(index: number, next: PollOptionDraft) {
    setPollOptions((prev) => {
      const out = [...prev];
      out[index] = next;
      return out;
    });
  }

  function addOption() {
    setPollOptions((prev) =>
      prev.length >= POLL_OPTION_MAX_COUNT ? prev : [...prev, emptyText()],
    );
  }

  function removeOption(index: number) {
    setPollOptions((prev) =>
      prev.length <= 2 ? prev : prev.filter((_, i) => i !== index),
    );
  }

  const isEditingDraft = Boolean(draft?.id);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {draft?.id && <input type="hidden" name="threadId" value={draft.id} />}

      {showSavedMessage && (
        <p className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">
          下書きを保存しました。
        </p>
      )}

      <label className="flex flex-col gap-1 text-sm">
        <span className="text-zinc-400">セッションタイトル</span>
        <input
          type="text"
          name="title"
          required
          defaultValue={draft?.title ?? ""}
          maxLength={120}
          placeholder="例: 2020年代の邦楽で一番好きなアルバムは？"
          className="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-zinc-100 focus:border-amber-500/50 focus:outline-none"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="text-zinc-400">セッションの説明</span>
        <textarea
          name="body"
          required
          rows={6}
          defaultValue={draft?.body ?? ""}
          maxLength={4000}
          placeholder="セッションのルールや背景、聞きたいことを書いてください。"
          className="resize-y rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-zinc-100 focus:border-amber-500/50 focus:outline-none"
        />
      </label>

      <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-4">
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="enablePoll"
            checked={enablePoll}
            onChange={(e) => setEnablePoll(e.target.checked)}
            className="rounded border-zinc-600 bg-zinc-900 text-amber-500 focus:ring-amber-500/50"
          />
          <span className="font-medium text-zinc-200">投票を付ける</span>
        </label>
        <p className="mt-1 text-xs text-zinc-500">
          選択肢は2〜{POLL_OPTION_MAX_COUNT}個まで。テキスト・アルバム・アーティストから選べます。
          セッション作成後は、返信した参加者も選択肢を追加できます（作成者は不可）。
        </p>

        {enablePoll && (
          <div className="mt-4 flex flex-col gap-3">
            <input type="hidden" name="pollOptionsJson" value={serialized} />

            {pollOptions.map((option, index) => (
              <PollOptionPicker
                key={index}
                index={index}
                option={option}
                onChange={(next) => updateOption(index, next)}
                onRemove={() => removeOption(index)}
                removable={pollOptions.length > 2}
              />
            ))}

            {pollOptions.length < POLL_OPTION_MAX_COUNT && (
              <button
                type="button"
                onClick={addOption}
                className="self-start text-sm text-amber-400 hover:underline"
              >
                + 選択肢を追加
              </button>
            )}

            <div className="rounded-md border border-sky-500/20 bg-sky-500/5 p-3">
              <label className="flex cursor-pointer items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  name="addViewOnlyOption"
                  checked={addViewOnlyOption}
                  disabled={!viewOnlySlotAvailable}
                  onChange={(e) => setAddViewOnlyOption(e.target.checked)}
                  className="mt-0.5 rounded border-zinc-600 bg-zinc-900 text-sky-400 focus:ring-sky-400/40 disabled:opacity-40"
                />
                <span className="text-zinc-200">
                  結果だけ見たい人向けの選択肢を付ける
                  <span className="mt-1 block text-xs font-normal text-zinc-500">
                    セッション作成時に「{DEFAULT_VIEW_ONLY_OPTION_LABEL}」を1つ追加します。
                    得票率の集計には含まれず、選ぶと結果だけ閲覧できます。
                    作成後は追加・変更できません。
                  </span>
                  {!viewOnlySlotAvailable && (
                    <span className="mt-1 block text-xs text-amber-400/90">
                      選択肢が上限（{POLL_OPTION_MAX_COUNT}個）のため付けられません。
                    </span>
                  )}
                </span>
              </label>
            </div>

            <PollResultPreview rows={previewRows} />
          </div>
        )}
      </div>

      {state.error && (
        <p className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {state.error}
          {state.error.includes("ログイン") && (
            <>
              {" "}
              <Link href="/login?redirect=/threads/new" className="underline">
                ログイン
              </Link>
            </>
          )}
        </p>
      )}

      <div className="flex flex-wrap gap-3">
        <button
          type="submit"
          name="intent"
          value="draft"
          formNoValidate
          disabled={pending}
          className="rounded-md border border-zinc-600 px-4 py-2 text-sm font-medium text-zinc-200 transition hover:border-zinc-500 disabled:opacity-60"
        >
          {pending ? "保存中…" : isEditingDraft ? "下書きを更新" : "下書き保存"}
        </button>
        <button
          type="submit"
          name="intent"
          value="publish"
          disabled={pending}
          className="rounded-md bg-amber-500 px-4 py-2 text-sm font-semibold text-zinc-950 transition hover:bg-amber-400 disabled:opacity-60"
        >
          {pending ? "公開中…" : isEditingDraft ? "公開する" : "セッションを公開する"}
        </button>
        <Link
          href="/threads"
          className="rounded-md border border-zinc-600 px-4 py-2 text-sm text-zinc-300 transition hover:border-zinc-500"
        >
          キャンセル
        </Link>
      </div>
    </form>
  );
}
