import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth/AuthForm";
import { getUser } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { pageTitle } from "@/lib/site";

export const metadata = {
  title: pageTitle("ログイン"),
};

type PageProps = {
  searchParams: Promise<{ error?: string; redirect?: string }>;
};

export default async function LoginPage({ searchParams }: PageProps) {
  const { error: queryError, redirect: redirectTo } = await searchParams;
  const redirectPath =
    redirectTo?.startsWith("/") && !redirectTo.startsWith("//")
      ? redirectTo
      : undefined;

  const user = await getUser();
  if (user) {
    redirect(redirectPath ?? "/");
  }

  return (
    <div className="page-shell mx-auto max-w-md">
      <header className="page-header text-center sm:text-left">
        <h1 className="page-title">アカウント</h1>
        <p className="page-desc">
          ログインしてセッションに参加したり、評価やレビューを残したりできます。
        </p>
      </header>

      {queryError === "auth_callback" && (
        <p className="alert alert-error mb-4">
          認証に失敗しました。もう一度お試しください。
        </p>
      )}

      {!isSupabaseConfigured() && (
        <p className="alert alert-warning mb-4">
          Supabase 未設定のため、ログインは利用できません。
        </p>
      )}

      <AuthForm redirect={redirectPath} />
    </div>
  );
}
