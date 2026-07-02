"use client";

import { useState, useTransition } from "react";
import { setUserAdminFlag } from "@/app/admin/actions";
import type { AdminUserRow } from "@/lib/data/admin";

type Props = {
  user: AdminUserRow;
  selfId: string | null;
};

export function AdminUserRowItem({ user, selfId }: Props) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(user.isAdmin);

  const isSelf = selfId === user.id;

  function handleToggle() {
    const next = !isAdmin;
    const verb = next ? "管理者にしますか？" : "管理者を解除しますか？";
    if (!confirm(`${user.email ?? user.username} を ${verb}`)) return;

    setError(null);
    startTransition(async () => {
      const result = await setUserAdminFlag(user.id, next);
      if (result.error) {
        setError(result.error);
        return;
      }
      setIsAdmin(next);
    });
  }

  return (
    <tr className="border-b border-zinc-800/50 align-top">
      <td className="px-3 py-3">
        <p className="font-medium text-zinc-100">
          {user.displayName || user.username}
          {isSelf && (
            <span className="ml-2 rounded bg-amber-500/15 px-1.5 py-0.5 text-xs text-amber-400/90">
              あなた
            </span>
          )}
        </p>
        <p className="text-xs text-zinc-500">
          {user.email ?? "—"} · @{user.username}
        </p>
      </td>
      <td className="px-3 py-3 text-center text-sm">
        {isAdmin ? (
          <span className="rounded bg-amber-500/20 px-2 py-0.5 text-xs font-medium text-amber-300">
            管理者
          </span>
        ) : (
          <span className="text-xs text-zinc-500">一般</span>
        )}
      </td>
      <td className="px-3 py-3 text-right">
        <button
          type="button"
          onClick={handleToggle}
          disabled={pending || (isAdmin && isSelf)}
          className="rounded-md border border-zinc-600 px-2.5 py-1 text-xs text-zinc-300 transition hover:border-amber-500/50 hover:text-amber-300 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending
            ? "更新中…"
            : isAdmin
              ? isSelf
                ? "解除不可"
                : "管理者を解除"
              : "管理者にする"}
        </button>
        {error && <p className="mt-1 text-xs text-red-300">{error}</p>}
      </td>
    </tr>
  );
}
