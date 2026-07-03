"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { deleteList } from "@/app/lists/actions";
import { ListMetaForm } from "@/components/list/ListMetaForm";

type ListOwnerActionsProps = {
  listId: string;
  initial: {
    title: string;
    description?: string;
    isPublic: boolean;
  };
};

export function ListOwnerActions({ listId, initial }: ListOwnerActionsProps) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [pending, setPending] = useState(false);

  async function handleDelete() {
    if (
      !window.confirm(
        "このリストを削除しますか？この操作は取り消せません。",
      )
    ) {
      return;
    }
    setPending(true);
    try {
      const fd = new FormData();
      fd.set("listId", listId);
      const result = await deleteList({}, fd);
      // 成功時は action 側で /lists へ redirect される。
      if (result?.error) {
        window.alert(result.error);
        setPending(false);
      }
    } catch {
      // redirect は例外として投げられるため、ここに来たら遷移中
      router.refresh();
    }
  }

  return (
    <div className="mb-6">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setEditing((v) => !v)}
          className="btn-secondary"
        >
          {editing ? "編集を閉じる" : "リストを編集"}
        </button>
        <button
          type="button"
          onClick={handleDelete}
          disabled={pending}
          className="rounded-[var(--radius-md)] border border-red-500/40 px-4 py-2 text-sm text-red-400 transition hover:border-red-500 disabled:opacity-50"
        >
          {pending ? "削除中…" : "リストを削除"}
        </button>
      </div>

      {editing && (
        <div className="surface-panel mt-4 px-5 py-5">
          <ListMetaForm mode="edit" listId={listId} initial={initial} />
        </div>
      )}
    </div>
  );
}
