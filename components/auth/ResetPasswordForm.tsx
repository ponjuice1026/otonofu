"use client";

import Link from "next/link";
import { useActionState } from "react";
import { updatePassword, type AuthFormState } from "@/app/login/actions";

const initialState: AuthFormState = {};

export function ResetPasswordForm() {
  const [state, action, pending] = useActionState(updatePassword, initialState);

  if (state.success) {
    return (
      <div className="surface-panel p-6">
        <p className="alert alert-success mb-4">{state.success}</p>
        <Link href="/login" className="btn-primary inline-block text-center">
          ログインへ
        </Link>
      </div>
    );
  }

  return (
    <div className="surface-panel p-6">
      <form action={action} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="text-neutral-400">新しいパスワード</span>
          <input
            type="password"
            name="password"
            required
            minLength={6}
            autoComplete="new-password"
            className="input-field"
            placeholder="6文字以上"
          />
        </label>
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="text-neutral-400">新しいパスワード（確認）</span>
          <input
            type="password"
            name="confirmPassword"
            required
            minLength={6}
            autoComplete="new-password"
            className="input-field"
            placeholder="もう一度入力"
          />
        </label>

        {state.error && <p className="alert alert-error">{state.error}</p>}

        <button type="submit" disabled={pending} className="btn-primary mt-1">
          {pending ? "処理中…" : "パスワードを変更"}
        </button>
      </form>
    </div>
  );
}
