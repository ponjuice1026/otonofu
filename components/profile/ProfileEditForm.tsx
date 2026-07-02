"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";
import {
  updateProfile,
  type ProfileActionState,
} from "@/app/profile/actions";
import { BIO_MAX_LENGTH } from "@/lib/profile/validate";

type ProfileEditFormProps = {
  initialDisplayName: string;
  initialUsername: string;
  initialBio: string;
};

const initialState: ProfileActionState = {};

export function ProfileEditForm({
  initialDisplayName,
  initialUsername,
  initialBio,
}: ProfileEditFormProps) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(
    updateProfile,
    initialState,
  );
  const [bio, setBio] = useState(initialBio);

  useEffect(() => {
    if (state.success) {
      router.refresh();
    }
  }, [state.success, router]);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-neutral-400">自己紹介</span>
        <textarea
          name="bio"
          rows={4}
          maxLength={BIO_MAX_LENGTH}
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          placeholder="好きなジャンル、注目しているアーティスト、お気に入りのアルバムなど"
          className="input-field resize-y"
        />
        <span className="text-xs text-neutral-500">
          {bio.length} / {BIO_MAX_LENGTH} 文字
        </span>
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="text-neutral-400">表示名</span>
        <input
          type="text"
          name="displayName"
          required
          maxLength={24}
          defaultValue={initialDisplayName}
          autoComplete="nickname"
          className="input-field"
        />
        <span className="text-xs text-neutral-500">
          セッションやコメントの「作成者」として表示される名前です。24文字まで。
        </span>
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="text-neutral-400">ユーザー名（@xxxx）</span>
        <input
          type="text"
          name="username"
          required
          minLength={3}
          maxLength={24}
          pattern="[A-Za-z0-9_\-]+"
          defaultValue={initialUsername}
          autoComplete="username"
          className="input-field"
        />
        <span className="text-xs text-neutral-500">
          半角英数字・ハイフン・アンダースコア、3〜24文字。重複は不可。
        </span>
      </label>

      {state.error && (
        <p className="alert alert-error">{state.error}</p>
      )}
      {state.success && (
        <p className="alert alert-success">{state.success}</p>
      )}

      <button type="submit" disabled={pending} className="btn-primary self-start">
        {pending ? "保存中…" : "保存する"}
      </button>
    </form>
  );
}
