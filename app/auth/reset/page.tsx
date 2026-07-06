import Link from "next/link";
import { ResetPasswordForm } from "@/components/auth/ResetPasswordForm";
import { getUser } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { pageTitle } from "@/lib/site";

export const metadata = {
  title: pageTitle("パスワード再設定"),
};

export default async function ResetPasswordPage() {
  const configured = isSupabaseConfigured();
  const user = configured ? await getUser() : null;

  return (
    <div className="page-shell mx-auto max-w-md">
      <header className="page-header text-center sm:text-left">
        <h1 className="page-title">パスワード再設定</h1>
        <p className="page-desc">新しいパスワードを設定してください。</p>
      </header>

      {!configured ? (
        <p className="alert alert-warning">
          Supabase 未設定のため、パスワード再設定は利用できません。
        </p>
      ) : !user ? (
        <div className="surface-panel p-6">
          <p className="alert alert-error mb-4">
            再設定リンクが無効か、有効期限が切れています。もう一度メールを送信してください。
          </p>
          <Link href="/login" className="btn-primary inline-block text-center">
            ログインへ戻る
          </Link>
        </div>
      ) : (
        <ResetPasswordForm />
      )}
    </div>
  );
}
