"use client";

import { useActionState, useState } from "react";
import {
  login,
  signup,
  type AuthFormState,
} from "@/app/login/actions";

const initialState: AuthFormState = {};

type AuthFormProps = {
  redirect?: string;
};

export function AuthForm({ redirect }: AuthFormProps) {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [loginState, loginAction, loginPending] = useActionState(
    login,
    initialState,
  );
  const [signupState, signupAction, signupPending] = useActionState(
    signup,
    initialState,
  );

  const state = mode === "login" ? loginState : signupState;
  const action = mode === "login" ? loginAction : signupAction;
  const pending = mode === "login" ? loginPending : signupPending;

  return (
    <div className="surface-panel p-6">
      <div className="tab-group mb-6 w-full">
        <button
          type="button"
          onClick={() => setMode("login")}
          className={`flex-1 ${mode === "login" ? "tab-item tab-item-active" : "tab-item"}`}
        >
          ログイン
        </button>
        <button
          type="button"
          onClick={() => setMode("signup")}
          className={`flex-1 ${mode === "signup" ? "tab-item tab-item-active" : "tab-item"}`}
        >
          新規登録
        </button>
      </div>

      <form action={action} className="flex flex-col gap-4">
        {redirect && <input type="hidden" name="redirect" value={redirect} />}

        {mode === "signup" && (
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-neutral-400">表示名</span>
            <input
              type="text"
              name="displayName"
              required
              maxLength={24}
              autoComplete="nickname"
              className="input-field"
              placeholder="セッションやコメントで表示される名前"
            />
            <span className="text-xs text-neutral-500">24文字まで</span>
          </label>
        )}

        <label className="flex flex-col gap-1.5 text-sm">
          <span className="text-neutral-400">メールアドレス</span>
          <input
            type="email"
            name="email"
            required
            autoComplete="email"
            className="input-field"
            placeholder="you@example.com"
          />
        </label>
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="text-neutral-400">パスワード</span>
          <input
            type="password"
            name="password"
            required
            minLength={6}
            autoComplete={
              mode === "login" ? "current-password" : "new-password"
            }
            className="input-field"
            placeholder={mode === "signup" ? "6文字以上" : ""}
          />
        </label>

        {state.error && <p className="alert alert-error">{state.error}</p>}
        {state.success && <p className="alert alert-success">{state.success}</p>}

        <button type="submit" disabled={pending} className="btn-primary mt-1">
          {pending
            ? "処理中…"
            : mode === "login"
              ? "ログイン"
              : "アカウントを作成"}
        </button>
      </form>
    </div>
  );
}
