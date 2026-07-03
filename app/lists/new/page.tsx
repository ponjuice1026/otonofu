import Link from "next/link";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth/session";
import { ListMetaForm } from "@/components/list/ListMetaForm";
import { pageTitle } from "@/lib/site";

export const metadata = {
  title: pageTitle("リストを作る"),
};

export const dynamic = "force-dynamic";

export default async function NewListPage() {
  const user = await getUser();
  if (!user) {
    redirect("/login?redirect=/lists/new");
  }

  return (
    <div className="page-shell mx-auto max-w-2xl">
      <Link
        href="/lists"
        className="link-accent mb-6 inline-block text-sm hover:underline"
      >
        ← リスト一覧
      </Link>

      <header className="page-header">
        <h1 className="page-title">リストを作る</h1>
        <p className="page-desc">
          作成後、詳細ページでアルバムを追加・並び替えできます。
        </p>
      </header>

      <section className="surface-panel px-5 py-5">
        <ListMetaForm mode="create" />
      </section>
    </div>
  );
}
