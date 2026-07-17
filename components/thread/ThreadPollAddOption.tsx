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

  const [prevState, setPrevState] = useState(state);
  if (state !== prevState) {
    setPrevState(state);
    if (state.success) {
      setOpen(false);
      setOption({ type: "text", label: "" });
    }
  }

  useEffect(() => {
    if (state.success) {
      router.refresh();
    }
  }, [state.success, router]);

  if (optionCount >= maxOptions) {
    return null;
  }

  return (
    <div className="mt-5 border-t border-[var(--border)] pt-5">
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="link-accent text-sm font-medium hover:underline"
        >
          ＋ 選択肢を追加（セッション参加者のみ）
        </button>
      ) : (
        <form action={formAction} className="flex flex-col gap-3">
          <input type="hidden" name="threadId" value={threadId} />
          <input type="hidden" name="pollOptionsJson" value={serialized} />

          <div>
            <p className="text-sm font-medium text-[var(--foreground)]">選択肢を追加</p>
            <p className="mt-1 text-xs text-[var(--muted)]">
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
            <p className="alert alert-error text-sm">
              {state.error}
            </p>
          )}

          <div className="flex flex-wrap gap-2">
            <button type="submit" disabled={pending} className="btn-primary">
              {pending ? "追加中…" : "選択肢を追加する"}
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="btn-secondary"
            >
              キャンセル
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
