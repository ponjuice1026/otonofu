"use client";

import { useActionState } from "react";
import {
  createList,
  updateList,
  type ListActionState,
} from "@/app/lists/actions";

type ListMetaFormProps = {
  mode: "create" | "edit";
  listId?: string;
  initial?: {
    title: string;
    description?: string;
    isPublic: boolean;
  };
};

const initialState: ListActionState = {};

export function ListMetaForm({ mode, listId, initial }: ListMetaFormProps) {
  const action = mode === "create" ? createList : updateList;
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {mode === "edit" && listId && (
        <input type="hidden" name="listId" value={listId} />
      )}

      <div>
        <label
          htmlFor="list-title"
          className="mb-1 block text-sm font-medium text-neutral-300"
        >
          タイトル
        </label>
        <input
          id="list-title"
          name="title"
          type="text"
          required
          maxLength={100}
          defaultValue={initial?.title ?? ""}
          placeholder="例: 90年代邦楽ロック名盤50選"
          className="input-field w-full"
        />
      </div>

      <div>
        <label
          htmlFor="list-description"
          className="mb-1 block text-sm font-medium text-neutral-300"
        >
          説明（任意）
        </label>
        <textarea
          id="list-description"
          name="description"
          maxLength={2000}
          rows={4}
          defaultValue={initial?.description ?? ""}
          placeholder="このリストのテーマや選定基準など"
          className="input-field w-full resize-y"
        />
      </div>

      <label className="flex items-center gap-2 text-sm text-neutral-300">
        <input
          type="checkbox"
          name="isPublic"
          defaultChecked={initial?.isPublic ?? true}
          value="on"
          className="h-4 w-4 accent-amber-500"
        />
        公開する（他のユーザーも閲覧できます）
      </label>

      {state.error && (
        <p className="text-sm text-red-400">{state.error}</p>
      )}
      {state.success && (
        <p className="text-sm text-emerald-400">{state.success}</p>
      )}

      <div>
        <button type="submit" disabled={pending} className="btn-primary">
          {pending
            ? "保存中…"
            : mode === "create"
              ? "リストを作成"
              : "変更を保存"}
        </button>
      </div>
    </form>
  );
}
