"use client";

import { type FormEvent, useState, useTransition } from "react";
import { addBannedWordAction } from "@/app/admin/actions";

export function BannedWordForm() {
  const [pending, startTransition] = useTransition();
  const [pattern, setPattern] = useState("");
  const [isRegex, setIsRegex] = useState(false);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    startTransition(async () => {
      const result = await addBannedWordAction(pattern, isRegex, note || null);
      if (result.error) {
        setError(result.error);
        return;
      }
      setSuccess(result.success ?? "追加しました。");
      setPattern("");
      setNote("");
      setIsRegex(false);
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mb-4 flex flex-col gap-3 rounded-lg border border-zinc-800 bg-zinc-900/30 p-4 sm:flex-row sm:items-end"
    >
      <div className="flex-1">
        <label className="mb-1 block text-xs text-zinc-500">
          ワード / 正規表現
        </label>
        <input
          type="text"
          value={pattern}
          onChange={(e) => setPattern(e.target.value)}
          placeholder="禁止したい語（部分一致）"
          maxLength={200}
          className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-1.5 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-amber-500/50 focus:outline-none"
        />
      </div>
      <div className="flex-1">
        <label className="mb-1 block text-xs text-zinc-500">メモ（任意）</label>
        <input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="理由など"
          maxLength={200}
          className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-1.5 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-amber-500/50 focus:outline-none"
        />
      </div>
      <label className="flex items-center gap-1.5 text-xs text-zinc-400">
        <input
          type="checkbox"
          checked={isRegex}
          onChange={(e) => setIsRegex(e.target.checked)}
          className="accent-amber-500"
        />
        正規表現
      </label>
      <button
        type="submit"
        disabled={pending}
        className="rounded-md border border-amber-500/50 px-3 py-1.5 text-sm text-amber-300 transition hover:border-amber-400 hover:text-amber-200 disabled:opacity-50"
      >
        {pending ? "追加中…" : "追加"}
      </button>
      {error && <p className="text-xs text-red-300">{error}</p>}
      {success && <p className="text-xs text-emerald-300">{success}</p>}
    </form>
  );
}
