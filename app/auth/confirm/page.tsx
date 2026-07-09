import Link from "next/link";
import { confirmEmailAction } from "./actions";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{ token_hash?: string; type?: string; next?: string }>;
};

export default async function ConfirmEmailPage({ searchParams }: PageProps) {
  const { token_hash: tokenHash, type, next } = await searchParams;
  const isValid = Boolean(tokenHash && type);

  return (
    <div className="page-shell mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center text-center">
      <h1 className="page-title">メールアドレスの確認</h1>

      {isValid ? (
        <>
          <p className="page-desc mx-auto mt-2">
            下のボタンを押すと、メールアドレスの確認が完了します。
          </p>
          <form action={confirmEmailAction} className="mt-8">
            <input type="hidden" name="token_hash" value={tokenHash} />
            <input type="hidden" name="type" value={type} />
            <input type="hidden" name="next" value={next ?? "/"} />
            <button type="submit" className="btn-primary">
              確認して続ける
            </button>
          </form>
        </>
      ) : (
        <>
          <p className="page-desc mx-auto mt-2">
            確認リンクが正しくないか、有効期限が切れています。お手数ですが、もう一度お試しください。
          </p>
          <div className="mt-8">
            <Link href="/login" className="btn-secondary">
              ログインへ
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
