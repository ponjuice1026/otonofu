"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useMemo, useState } from "react";
import {
  addDiscussionPollOption,
  type ThreadActionState,
} from "@/app/threads/actions";
import {
  PollOptionPicker,
  type PollOptionDraft,
} from "@/components/thread/PollOptionPicker";
import { serializePollOptionDrafts } from "@/lib/threads/poll-defaults";

type ThreadPollAddOptionProps = {
  threadId: string;
  optionCount: number;
  maxOptions: number;
};

const initialState: ThreadActionState = {};

export function ThreadPollAddOption({
  threadId,
  optionCount,
  maxOptions,
}: ThreadPollAddOptionProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [option, setOption] = useState<PollOptionDraft>({ type: "text", label: "" });
  const [state, formAction, pending] = useActionState(
    addDiscussionPollOption,
    initialState,
  );

  const serialized = useMemo(
    () => serializePollOptionDrafts([option]),
    [option],
  );

  useEffect(() => {
    if (state.success) {
      setOpen(false);
      setOption({ type: "text", label: "" });
      router.refresh();
    }
  }, [state.success, router]);

  if (optionCount >= maxOptions) {
    return null;
  }

  return (
    <div className="mt-5 border-t border-zinc-800 pt-5">
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="text-sm font-medium text-amber-400 transition hover:text-amber-300"
        >
          ＋ 選択肢を追加（セッション参加者のみ）
        </button>
      ) : (
        <form action={formAction} className="flex flex-col gap-3">
          <input type="hidden" name="threadId" value={threadId} />
          <input type="hidden" name="pollOptionsJson" value={serialized} />

          <div>
            <p className="text-sm font-medium text-zinc-200">選択肢を追加</p>
            <p className="mt-1 text-xs text-zinc-500">
              このセッションに返信した参加者だけが追加できます（作成者は不可）。
              残り {maxOptions - optionCount} 件まで追加可能です。
            </p>
          </div>

          <PollOptionPicker
            index={0}
            option={option}
            onChange={setOption}
            onRemove={() => setOption({ type: "text", label: "" })}
            removable={false}
          />

          {state.error && (
            <p className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
              {state.error}
            </p>
          )}

          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={pending}
              className="rounded-md bg-amber-500 px-4 py-2 text-sm font-semibold text-zinc-950 transition hover:bg-amber-400 disabled:opacity-60"
            >
              {pending ? "追加中…" : "選択肢を追加する"}
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-md border border-zinc-600 px-4 py-2 text-sm text-zinc-300 transition hover:border-zinc-500"
            >
              キャンセル
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
