"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import {
  submitContribution,
  type ContributeActionState,
} from "@/app/contribute/actions";
import {
  CONTRIBUTION_KIND_LABELS,
  isContributionKind,
} from "@/lib/contributions/constants";
import type { ContributionKind } from "@/lib/types";

type ContributeFormProps = {
  initialKind: ContributionKind;
  /** fix_data のときの修正対象（表示名とID） */
  target?: {
    artistId?: string;
    albumId?: string;
    label: string;
  };
};

const initialState: ContributeActionState = {};

const inputClass =
  "w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 focus:border-amber-500/50 focus:outline-none";
const labelClass = "mb-1 block text-sm font-medium text-zinc-300";

export function ContributeForm({ initialKind, target }: ContributeFormProps) {
  const [kind, setKind] = useState<ContributionKind>(initialKind);
  const [state, formAction, pending] = useActionState(
    submitContribution,
    initialState,
  );

  // 修正対象が渡されている場合は fix_data 固定
  const lockedFix = Boolean(target);

  if (state.success) {
    return (
      <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-4 py-4">
        <p className="text-sm text-emerald-200">{state.success}</p>
        <div className="mt-3 flex gap-3 text-sm">
          <Link href="/profile#my-contributions" className="link-accent hover:underline">
            申請状況を確認する →
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="kind" value={kind} />
      {target?.artistId && (
        <input type="hidden" name="targetArtistId" value={target.artistId} />
      )}
      {target?.albumId && (
        <input type="hidden" name="targetAlbumId" value={target.albumId} />
      )}

      {lockedFix ? (
        <div className="rounded-md border border-zinc-800 bg-zinc-900/50 px-3 py-2 text-sm text-zinc-300">
          修正対象: <span className="text-zinc-100">{target?.label}</span>
        </div>
      ) : (
        <div>
          <span className={labelClass}>申請の種類</span>
          <div className="flex flex-col gap-2 sm:flex-row">
            {(Object.keys(CONTRIBUTION_KIND_LABELS) as ContributionKind[])
              .filter((k) => k !== "fix_data")
              .map((k) => (
                <label
                  key={k}
                  className={`flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm transition ${
                    kind === k
                      ? "border-amber-500/60 bg-amber-500/10 text-amber-200"
                      : "border-zinc-700 text-zinc-300 hover:border-zinc-500"
                  }`}
                >
                  <input
                    type="radio"
                    name="kindChoice"
                    className="accent-amber-500"
                    checked={kind === k}
                    onChange={() => {
                      if (isContributionKind(k)) setKind(k);
                    }}
                  />
                  {CONTRIBUTION_KIND_LABELS[k]}
                </label>
              ))}
          </div>
        </div>
      )}

      {kind === "fix_data" ? (
        <div>
          <label htmlFor="detail" className={labelClass}>
            修正内容 <span className="text-red-400">*</span>
          </label>
          <textarea
            id="detail"
            name="detail"
            rows={5}
            required
            maxLength={2000}
            placeholder="どの情報が誤っているか、正しくはどうあるべきかを具体的に記入してください。"
            className={`${inputClass} resize-y`}
          />
        </div>
      ) : (
        <>
          <div>
            <label htmlFor="name" className={labelClass}>
              {kind === "add_artist" ? "アーティスト名" : "アルバム名"}{" "}
              <span className="text-red-400">*</span>
            </label>
            <input id="name" name="name" type="text" required className={inputClass} />
          </div>

          {kind === "add_album" && (
            <div>
              <label htmlFor="artistName" className={labelClass}>
                アーティスト名
              </label>
              <input
                id="artistName"
                name="artistName"
                type="text"
                className={inputClass}
              />
            </div>
          )}

          <div>
            <label htmlFor="reading" className={labelClass}>
              読み（かな）
            </label>
            <input id="reading" name="reading" type="text" className={inputClass} />
          </div>

          <div>
            <label htmlFor="year" className={labelClass}>
              発表年
            </label>
            <input
              id="year"
              name="year"
              type="text"
              inputMode="numeric"
              placeholder="例: 1983"
              className={inputClass}
            />
          </div>

          {kind === "add_album" && (
            <>
              <div>
                <label htmlFor="label" className={labelClass}>
                  レーベル
                </label>
                <input id="label" name="label" type="text" className={inputClass} />
              </div>
              <div>
                <label htmlFor="tracklist" className={labelClass}>
                  トラックリスト
                </label>
                <textarea
                  id="tracklist"
                  name="tracklist"
                  rows={5}
                  maxLength={2000}
                  placeholder="1曲ずつ改行して記入してください。"
                  className={`${inputClass} resize-y`}
                />
              </div>
            </>
          )}

          {kind === "add_artist" && (
            <div>
              <label htmlFor="note" className={labelClass}>
                補足
              </label>
              <textarea
                id="note"
                name="note"
                rows={3}
                maxLength={2000}
                placeholder="出身・活動期間・代表作など、判断材料になる情報があれば。"
                className={`${inputClass} resize-y`}
              />
            </div>
          )}
        </>
      )}

      {state.error && (
        <p className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {state.error}
        </p>
      )}

      <div>
        <button
          type="submit"
          disabled={pending}
          className="btn-primary disabled:opacity-60"
        >
          {pending ? "送信中…" : "申請を送信"}
        </button>
      </div>
    </form>
  );
}
