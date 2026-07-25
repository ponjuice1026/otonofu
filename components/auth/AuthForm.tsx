"use client";

import { useActionState, useState } from "react";
import {
  login,
  signup,
  signInWithGoogle,
  requestPasswordReset,
  type AuthFormState,
} from "@/app/login/actions";

const initialState: AuthFormState = {};

function GoogleMark() {
  return (
    <svg
      viewBox="0 0 18 18"
      className="h-[18px] w-[18px]"
      aria-hidden="true"
      focusable="false"
    >
      <path
        fill="#4285F4"
        d="M17.64 9.2045c0-.6381-.0573-1.2518-.1636-1.8409H9v3.4814h4.8436c-.2086 1.125-.8427 2.0782-1.7959 2.7164v2.2581h2.9081c1.7018-1.5668 2.6841-3.874 2.6841-6.615z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.4673-.806 5.9564-2.1805l-2.9081-2.2581c-.8059.54-1.8368.859-3.0483.859-2.344 0-4.3282-1.5831-5.0364-3.7104H.9573v2.3318C2.4382 15.9832 5.4818 18 9 18z"
      />
      <path
        fill="#FBBC05"
        d="M3.9636 10.71c-.18-.54-.2823-1.1168-.2823-1.71s.1023-1.17.2823-1.71V4.9582H.9573C.3477 6.1732 0 7.5477 0 9s.3477 2.8268.9573 4.0418L3.9636 10.71z"
      />
      <path
        fill="#EA4335"
        d="M9 3.5795c1.3214 0 2.5077.4541 3.4405 1.346l2.5813-2.5814C13.4632.8918 11.426 0 9 0 5.4818 0 2.4382 2.0168.9573 4.9582L3.9636 7.29C4.6718 5.1627 6.656 3.5795 9 3.5795z"
      />
    </svg>
  );
}

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
  const [googleState, googleAction, googlePending] = useActionState(
    signInWithGoogle,
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

      {mode !== "forgot" && (
        <div className="mb-6">
          <form action={googleAction}>
            {redirect && (
              <input type="hidden" name="redirect" value={redirect} />
            )}
            <button
              type="submit"
              disabled={googlePending}
              className="flex w-full items-center justify-center gap-2.5 rounded-md border border-neutral-300 bg-white px-4 py-2.5 text-sm font-medium text-neutral-800 transition hover:bg-neutral-100 disabled:opacity-60"
            >
              <GoogleMark />
              {googlePending
                ? "Google に移動中…"
                : mode === "login"
                  ? "Google でログイン"
                  : "Google で登録"}
            </button>
          </form>
          {googleState.error && (
            <p className="alert alert-error mt-3">{googleState.error}</p>
          )}
          <div className="mt-5 flex items-center gap-3 text-xs text-neutral-500">
            <span className="h-px flex-1 bg-neutral-700" />
            または
            <span className="h-px flex-1 bg-neutral-700" />
          </div>
        </div>
      )}

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
