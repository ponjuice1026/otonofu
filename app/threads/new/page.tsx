import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CreateThreadForm } from "@/components/thread/CreateThreadForm";
import { getUser } from "@/lib/auth/session";
import {
  getThreadDraftForEdit,
  getUserThreadDrafts,
} from "@/lib/data/threads";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { formatThreadDate } from "@/lib/threads/format";
import { pageTitle } from "@/lib/site";

export const metadata = {
  title: pageTitle("セッションを作成"),
};

type PageProps = {
  searchParams: Promise<{ draft?: string; saved?: string }>;
};

export default async function NewThreadPage({ searchParams }: PageProps) {
  const user = await getUser();

  if (!user) {
    redirect("/login?redirect=/threads/new");
  }

  const { draft: draftId, saved } = await searchParams;
  const [draft, drafts] = await Promise.all([
    draftId ? getThreadDraftForEdit(draftId, user.id) : Promise.resolve(null),
    getUserThreadDrafts(user.id),
  ]);

  if (draftId && !draft) {
    notFound();
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <Link
        href="/threads"
        className="link-accent mb-6 inline-block text-sm transition hover:underline"
      >
        ← セッション一覧
      </Link>

      <h1 className="mb-2 text-2xl font-bold text-[var(--foreground)]">
        {draft ? "下書きを編集" : "セッションを作成"}
      </h1>
      <p className="mb-8 text-sm text-[var(--muted)]">
        {draft
          ? "下書きはあなたにだけ表示されます。準備ができたら公開してください。"
          : "あなたの名前でセッションが公開されます。コメントは誰でも匿名で投稿できます。"}
      </p>

      {!isSupabaseConfigured() && (
        <p className="alert alert-warning mb-6 text-sm">
          Supabase 未設定のため、セッションは作成できません。
        </p>
      )}

      {drafts.length > 0 && (
        <section className="surface-panel mb-8 p-4">
          <h2 className="mb-3 text-sm font-semibold text-[var(--foreground)]">下書き</h2>
          <ul className="flex flex-col gap-2">
            {drafts.map((item) => (
              <li key={item.id}>
                <Link
                  href={`/threads/new?draft=${item.id}`}
                  className={`block rounded-md border px-3 py-2 text-sm transition ${
                    draft?.id === item.id
                      ? "border-[var(--brand-amber)] bg-[var(--brand-amber-soft)] text-[var(--foreground)]"
                      : "border-[var(--border)] bg-[var(--surface)] text-[var(--muted-foreground)] hover:border-[var(--border-strong)]"
                  }`}
                >
                  <span className="font-medium text-[var(--foreground)]">{item.title}</span>
                  <span className="mt-1 block text-xs text-[var(--muted)]">
                    更新 {formatThreadDate(item.updatedAt)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <CreateThreadForm
        key={draft?.id ?? "new"}
        draft={draft}
        showSavedMessage={saved === "1"}
      />
    </div>
  );
}
