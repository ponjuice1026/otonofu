"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { moveListItem, removeAlbumFromList } from "@/app/lists/actions";

type ListItemControlsProps = {
  listId: string;
  itemId: string;
  isFirst: boolean;
  isLast: boolean;
};

export function ListItemControls({
  listId,
  itemId,
  isFirst,
  isLast,
}: ListItemControlsProps) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function run(fn: () => Promise<{ error?: string }>) {
    setPending(true);
    try {
      const result = await fn();
      if (result.error) {
        window.alert(result.error);
      } else {
        router.refresh();
      }
    } finally {
      setPending(false);
    }
  }

  function move(direction: "up" | "down") {
    const fd = new FormData();
    fd.set("listId", listId);
    fd.set("itemId", itemId);
    fd.set("direction", direction);
    void run(() => moveListItem({}, fd));
  }

  function remove() {
    if (!window.confirm("このアルバムをリストから削除しますか？")) return;
    const fd = new FormData();
    fd.set("listId", listId);
    fd.set("itemId", itemId);
    void run(() => removeAlbumFromList({}, fd));
  }

  return (
    <div className="flex shrink-0 items-center gap-1">
      <button
        type="button"
        onClick={() => move("up")}
        disabled={pending || isFirst}
        aria-label="上へ"
        className="rounded border border-zinc-700 px-2 py-1 text-xs text-neutral-400 transition hover:border-zinc-500 disabled:opacity-30"
      >
        ↑
      </button>
      <button
        type="button"
        onClick={() => move("down")}
        disabled={pending || isLast}
        aria-label="下へ"
        className="rounded border border-zinc-700 px-2 py-1 text-xs text-neutral-400 transition hover:border-zinc-500 disabled:opacity-30"
      >
        ↓
      </button>
      <button
        type="button"
        onClick={remove}
        disabled={pending}
        className="rounded border border-zinc-700 px-2 py-1 text-xs text-red-400 transition hover:border-red-500/60 disabled:opacity-40"
      >
        削除
      </button>
    </div>
  );
}
