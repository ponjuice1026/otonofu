"use client";

import { type FormEvent, useState, useTransition } from "react";
import { banUserAction } from "@/app/admin/actions";
import type { BanSubjectType } from "@/lib/data/bans";

export function BanForm() {
  const [pending, startTransition] = useTransition();
  const [subjectType, setSubjectType] = useState<BanSubjectType>("voter");
  const [subjectKey, setSubjectKey] = useState("");
  const [reason, setReason] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    startTransition(async () => {
      const result = await banUserAction({
        subjectType,
        subjectKey,
        reason: reason || null,
        expiresAt: expiresAt || null,
      });
      if (result.error) {
        setError(result.error);
        return;
      }
      setSuccess(result.success ?? "追加しました。");
      setSubjectKey("");
      setReason("");
      setExpiresAt("");
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mb-4 flex flex-col gap-3 rounded-lg border border-zinc-800 bg-zinc-900/30 p-4"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div>
          <label className="mb-1 block text-xs text-zinc-500">対象種別</label>
          <select
            value={subjectType}
            onChange={(e) => setSubjectType(e.target.value as BanSubjectType)}
            className="rounded-md border border-zinc-700 bg-zinc-950 px-3 py-1.5 text-sm text-zinc-100 focus:border-amber-500/50 focus:outline-none"
          >
            <option value="voter">匿名 (voter_key)</option>
            <option value="user">ユーザー (user_id)</option>
          </select>
        </div>
        <div className="flex-1">
          <label className="mb-1 block text-xs text-zinc-500">
            対象キー（voter_key または user_id を貼り付け）
          </label>
          <input
            type="text"
            value={subjectKey}
            onChange={(e) => setSubjectKey(e.target.value)}
            placeholder="対象の voter_key / user_id"
            maxLength={200}
            className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-1.5 font-mono text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-amber-500/50 focus:outline-none"
          />
        </div>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1">
          <label className="mb-1 block text-xs text-zinc-500">理由（任意）</label>
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="荒らし・スパムなど"
            maxLength={500}
            className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-1.5 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-amber-500/50 focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-zinc-500">
            有効期限（任意・空欄で無期限）
          </label>
          <input
            type="datetime-local"
            value={expiresAt}
            onChange={(e) => setExpiresAt(e.target.value)}
            className="rounded-md border border-zinc-700 bg-zinc-950 px-3 py-1.5 text-sm text-zinc-100 focus:border-amber-500/50 focus:outline-none"
          />
        </div>
        <button
          type="submit"
          disabled={pending}
          className="rounded-md border border-red-500/50 px-3 py-1.5 text-sm text-red-300 transition hover:border-red-400 hover:text-red-200 disabled:opacity-50"
        >
          {pending ? "BAN 中…" : "BAN する"}
        </button>
      </div>
      {error && <p className="text-xs text-red-300">{error}</p>}
      {success && <p className="text-xs text-emerald-300">{success}</p>}
    </form>
  );
}
