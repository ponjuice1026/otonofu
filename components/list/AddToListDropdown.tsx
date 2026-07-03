"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { addAlbumToList } from "@/app/lists/actions";
import type { OwnListOption } from "@/lib/data/lists";

type AddToListDropdownProps = {
  albumId: string;
  isLoggedIn: boolean;
  lists: OwnListOption[];
};

/**
 * アルバム詳細ページの「リストに追加」ドロップダウン。
 * 自分のリストを選んで即追加する。既に含まれるリストは選択不可。
 */
export function AddToListDropdown({
  albumId,
  isLoggedIn,
  lists,
}: AddToListDropdownProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [message, setMessage] = useState<{
    type: "error" | "success";
    text: string;
  } | null>(null);

  if (!isLoggedIn) {
    return (
      <Link
        href={`/login?redirect=/albums/${albumId}`}
        className="btn-secondary inline-block text-sm"
      >
        ログインしてリストに追加
      </Link>
    );
  }

  async function add(listId: string) {
    setPendingId(listId);
    setMessage(null);
    try {
      const fd = new FormData();
      fd.set("listId", listId);
      fd.set("albumId", albumId);
      const result = await addAlbumToList({}, fd);
      if (result.error) {
        setMessage({ type: "error", text: result.error });
      } else {
        setMessage({
          type: "success",
          text: result.success ?? "追加しました。",
        });
        router.refresh();
      }
    } finally {
      setPendingId(null);
    }
  }

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="btn-secondary text-sm"
      >
        リストに追加 ▾
      </button>

      {open && (
        <div className="absolute z-20 mt-2 w-64 rounded-md border border-zinc-700 bg-zinc-900 p-2 shadow-lg">
          {lists.length === 0 ? (
            <div className="px-2 py-2 text-sm text-neutral-400">
              <p>まだリストがありません。</p>
              <Link
                href="/lists/new"
                className="link-accent mt-1 inline-block hover:underline"
              >
                リストを作る →
              </Link>
            </div>
          ) : (
            <ul className="max-h-64 overflow-y-auto">
              {lists.map((list) => (
                <li key={list.id}>
                  <button
                    type="button"
                    onClick={() => add(list.id)}
                    disabled={list.containsAlbum || pendingId === list.id}
                    className="flex w-full items-center justify-between gap-2 rounded px-2 py-2 text-left text-sm text-neutral-100 transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:text-neutral-500"
                  >
                    <span className="min-w-0 flex-1 truncate">
                      {list.title}
                      {!list.isPublic && (
                        <span className="ml-1 text-xs text-neutral-500">
                          (非公開)
                        </span>
                      )}
                    </span>
                    {list.containsAlbum && (
                      <span className="shrink-0 text-xs text-emerald-400">
                        追加済み
                      </span>
                    )}
                    {pendingId === list.id && (
                      <span className="shrink-0 text-xs text-neutral-400">
                        …
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-1 border-t border-zinc-800 pt-1">
            <Link
              href="/lists/new"
              className="block rounded px-2 py-2 text-sm text-neutral-400 transition hover:bg-zinc-800"
            >
              + 新しいリストを作る
            </Link>
          </div>
        </div>
      )}

      {message && (
        <p
          className={`mt-2 text-sm ${
            message.type === "error" ? "text-red-400" : "text-emerald-400"
          }`}
        >
          {message.text}
        </p>
      )}
    </div>
  );
}
