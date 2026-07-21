"use client";

import Link from "next/link";
import { useActionState } from "react";
import {
  submitContactMessage,
  type ContactActionState,
} from "@/app/contact/actions";
import {
  CONTACT_CATEGORIES,
  CONTACT_CATEGORY_LABELS,
  CONTACT_LIMITS,
} from "@/lib/contact/constants";

type ContactFormProps = {
  /** ログイン中なら初期値として埋めておく */
  defaultName?: string;
  defaultEmail?: string;
};

const initialState: ContactActionState = {};

const labelClass = "mb-1 block text-sm font-medium text-zinc-300";

export function ContactForm({ defaultName, defaultEmail }: ContactFormProps) {
  const [state, formAction, pending] = useActionState(
    submitContactMessage,
    initialState,
  );

  if (state.success) {
    return (
      <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-4 py-4">
        <p className="text-sm text-emerald-200">{state.success}</p>
        <div className="mt-3 text-sm">
          <Link href="/" className="link-accent hover:underline">
            ホームに戻る →
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {/* ハニーポット。スクリーンリーダーと視覚の両方から隠す */}
      <div aria-hidden="true" className="hidden">
        <label htmlFor="contact-website">Website</label>
        <input
          id="contact-website"
          type="text"
          name="website"
          tabIndex={-1}
          autoComplete="off"
        />
      </div>

      <div>
        <label htmlFor="contact-category" className={labelClass}>
          お問い合わせの種類
        </label>
        <select
          id="contact-category"
          name="category"
          required
          defaultValue="question"
          className="input-field"
        >
          {CONTACT_CATEGORIES.map((category) => (
            <option key={category} value={category}>
              {CONTACT_CATEGORY_LABELS[category]}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="contact-name" className={labelClass}>
          お名前・ハンドルネーム
        </label>
        <input
          id="contact-name"
          type="text"
          name="name"
          required
          maxLength={CONTACT_LIMITS.name}
          defaultValue={defaultName}
          autoComplete="name"
          className="input-field"
        />
      </div>

      <div>
        <label htmlFor="contact-email" className={labelClass}>
          メールアドレス
        </label>
        <input
          id="contact-email"
          type="email"
          name="email"
          required
          maxLength={CONTACT_LIMITS.email}
          defaultValue={defaultEmail}
          autoComplete="email"
          className="input-field"
        />
        <p className="mt-1 text-xs text-zinc-500">
          回答をお送りする宛先です。お間違えのないようご確認ください。
        </p>
      </div>

      <div>
        <label htmlFor="contact-body" className={labelClass}>
          お問い合わせ内容
        </label>
        <textarea
          id="contact-body"
          name="body"
          required
          rows={8}
          minLength={10}
          maxLength={CONTACT_LIMITS.body}
          placeholder="できるだけ具体的にご記入ください。不具合の場合は、お使いの端末・ブラウザと、発生した操作の手順を添えていただけると助かります。"
          className="input-field"
        />
      </div>

      {state.error && (
        <p className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">
          {state.error}
        </p>
      )}

      <p className="text-xs text-zinc-500">
        送信することで、
        <Link href="/privacy" className="link-accent hover:underline">
          プライバシーポリシー
        </Link>
        に同意したものとみなします。
      </p>

      <div>
        <button type="submit" className="btn-primary" disabled={pending}>
          {pending ? "送信中…" : "送信する"}
        </button>
      </div>
    </form>
  );
}
