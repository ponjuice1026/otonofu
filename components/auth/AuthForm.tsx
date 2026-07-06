"use client";

import { useActionState, useState } from "react";
import {
  login,
  signup,
  requestPasswordReset,
  type AuthFormState,
} from "@/app/login/actions";

const initialState: AuthFormState = {};

type AuthFormProps = {
  redirect?: string;
};

export function AuthForm({ redirect }: AuthFormProps) {
  const [mode, setMode] = useState<"login" | "signup" | "forgot">("login");
  const [loginState, loginAction, loginPending] = useActionState(
    login,
    initialState,
  );
  const [signupState, signupAction, signupPending] = useActionState(
    signup,
    initialState,
  );
  const [forgotState, forgotAction, forgotPending] = useActionState(
    requestPasswordReset,
    initialState,
  );

  const state =
    mode === "login"
      ? loginState
      : mode === "signup"
        ? signupState
        : forgotState;
  const action =
    mode === "login"
      ? loginAction
      : mode === "signup"
        ? signupAction
        : forgotAction;
  const pending =
    mode === "login"
      ? loginPending
      : mode === "signup"
        ? signupPending
        : forgotPending;

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

      {mode === "forgot" && (
        <p className="page-desc mb-4 text-sm">
          登録済みのメールアドレスを入力してください。パスワード再設定用のリンクをお送りします。
        </p>
      )}

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
        {mode !== "forgot" && (
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
        )}

        {mode === "login" && (
          <button
            type="button"
            onClick={() => setMode("forgot")}
            className="self-end text-xs text-neutral-400 underline underline-offset-2 hover:text-neutral-200"
          >
            パスワードをお忘れですか？
          </button>
        )}

        {state.error && <p className="alert alert-error">{state.error}</p>}
        {state.success && <p className="alert alert-success">{state.success}</p>}

        <button type="submit" disabled={pending} className="btn-primary mt-1">
          {pending
            ? "処理中…"
            : mode === "login"
              ? "ログイン"
              : mode === "signup"
                ? "アカウントを作成"
                : "再設定メールを送信"}
        </button>

        {mode === "forgot" && (
          <button
            type="button"
            onClick={() => setMode("login")}
            className="self-center text-xs text-neutral-400 underline underline-offset-2 hover:text-neutral-200"
          >
            ログインに戻る
          </button>
        )}
      </form>
    </div>
  );
}
