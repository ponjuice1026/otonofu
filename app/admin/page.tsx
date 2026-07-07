import { redirect } from "next/navigation";
import { AdminContributionRowItem } from "@/components/admin/AdminContributionRow";
import { AdminReportRowItem } from "@/components/admin/AdminReportRow";
import { AdminThreadRowItem } from "@/components/admin/AdminThreadRow";
import { AdminUserRowItem } from "@/components/admin/AdminUserRow";
import { BannedWordForm } from "@/components/admin/BannedWordForm";
import { BannedWordRowItem } from "@/components/admin/BannedWordRow";
import { BanForm } from "@/components/admin/BanForm";
import { BanRowItem } from "@/components/admin/BanRow";
import { isCurrentUserAdmin } from "@/lib/auth/admin";
import { getUser } from "@/lib/auth/session";
import {
  getAdminStats,
  getAdminThreads,
  getAdminUsers,
} from "@/lib/data/admin";
import { getAdminReports } from "@/lib/data/reports";
import { getPendingContributions } from "@/lib/data/contributions";
import { getBannedWords } from "@/lib/data/moderation";
import { listBans } from "@/lib/data/bans";
import { pageTitle } from "@/lib/site";

export const metadata = {
  title: pageTitle("管理画面"),
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const user = await getUser();
  if (!user) redirect("/login?redirect=/admin");

  const admin = await isCurrentUserAdmin();
  if (!admin) redirect("/");

  const [stats, threads, users, reports, contributions, bannedWords, bans] =
    await Promise.all([
      getAdminStats(),
      getAdminThreads(50),
      getAdminUsers(100),
      getAdminReports(50),
      getPendingContributions(50),
      getBannedWords(),
      listBans(),
    ]);

  const statCards: { label: string; value: number }[] = [
    { label: "未処理の通報", value: stats.pendingReports },
    { label: "未処理の申請", value: contributions.length },
    { label: "セッション", value: stats.totalThreads },
    { label: "コメント", value: stats.totalPosts },
    { label: "投票", value: stats.totalVotes },
    { label: "ユーザー", value: stats.totalUsers },
    { label: "管理者", value: stats.totalAdmins },
  ];

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <header className="mb-8">
        <p className="mb-1 text-xs font-medium uppercase tracking-wide text-amber-400/90">
          Admin
        </p>
        <h1 className="text-2xl font-bold text-zinc-50">管理画面</h1>
        <p className="mt-1 text-sm text-zinc-500">
          通報の確認、セッション・コメントの削除、管理者の追加／解除ができます。
        </p>
      </header>

      <section className="mb-10">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-7">
          {statCards.map((card) => (
            <div
              key={card.label}
              className="rounded-lg border border-zinc-800 bg-zinc-900/50 px-4 py-3"
            >
              <p className="text-xs text-zinc-500">{card.label}</p>
              <p className="mt-1 text-xl font-semibold text-zinc-100">
                {card.value.toLocaleString("ja-JP")}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="mb-10">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-lg font-semibold text-zinc-100">通報キュー</h2>
          <p className="text-xs text-zinc-500">未処理 {reports.length} 件</p>
        </div>
        <div className="overflow-x-auto rounded-lg border border-zinc-800 bg-zinc-900/30">
          <table className="min-w-full text-left">
            <thead className="text-xs text-zinc-500">
              <tr className="border-b border-zinc-800">
                <th className="px-3 py-2 font-medium">内容</th>
                <th className="px-3 py-2 font-medium">理由</th>
                <th className="px-3 py-2 font-medium">詳細</th>
                <th className="px-3 py-2 font-medium">日時</th>
                <th className="px-3 py-2 text-right font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {reports.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-3 py-6 text-center text-sm text-zinc-500"
                  >
                    未処理の通報はありません。
                  </td>
                </tr>
              ) : (
                reports.map((report) => (
                  <AdminReportRowItem key={report.id} report={report} />
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mb-10">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-lg font-semibold text-zinc-100">NG ワード管理</h2>
          <p className="text-xs text-zinc-500">{bannedWords.length} 件</p>
        </div>
        <p className="mb-3 text-xs text-zinc-500">
          追加した語を含む投稿は弾かれます（部分一致・大文字小文字は無視）。正規表現も指定できます。
          DB・アプリ両方で強制されます。
        </p>
        <BannedWordForm />
        <div className="overflow-x-auto rounded-lg border border-zinc-800 bg-zinc-900/30">
          <table className="min-w-full text-left">
            <thead className="text-xs text-zinc-500">
              <tr className="border-b border-zinc-800">
                <th className="px-3 py-2 font-medium">ワード</th>
                <th className="px-3 py-2 font-medium">メモ</th>
                <th className="px-3 py-2 font-medium">追加日時</th>
                <th className="px-3 py-2 text-right font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {bannedWords.length === 0 ? (
                <tr>
                  <td
                    colSpan={4}
                    className="px-3 py-6 text-center text-sm text-zinc-500"
                  >
                    NG ワードは登録されていません。
                  </td>
                </tr>
              ) : (
                bannedWords.map((word) => (
                  <BannedWordRowItem key={word.id} word={word} />
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mb-10">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-lg font-semibold text-zinc-100">BAN 管理</h2>
          <p className="text-xs text-zinc-500">{bans.length} 件</p>
        </div>
        <p className="mb-3 text-xs text-zinc-500">
          匿名（voter_key）とログインユーザー（user_id）を投稿禁止にできます。
          対象キーを貼り付けて BAN してください。BAN された対象は投稿・コメント・投票が拒否されます。
        </p>
        <BanForm />
        <div className="overflow-x-auto rounded-lg border border-zinc-800 bg-zinc-900/30">
          <table className="min-w-full text-left">
            <thead className="text-xs text-zinc-500">
              <tr className="border-b border-zinc-800">
                <th className="px-3 py-2 font-medium">対象</th>
                <th className="px-3 py-2 font-medium">理由</th>
                <th className="px-3 py-2 font-medium">BAN 日時</th>
                <th className="px-3 py-2 font-medium">有効期限</th>
                <th className="px-3 py-2 text-right font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {bans.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-3 py-6 text-center text-sm text-zinc-500"
                  >
                    BAN は登録されていません。
                  </td>
                </tr>
              ) : (
                bans.map((ban) => <BanRowItem key={ban.id} ban={ban} />)
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mb-10">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-lg font-semibold text-zinc-100">データ申請キュー</h2>
          <p className="text-xs text-zinc-500">未処理 {contributions.length} 件</p>
        </div>
        <p className="mb-3 text-xs text-zinc-500">
          ユーザーからの追加・修正リクエスト。承認/却下でステータスを更新します。
          実データへの反映は SQL または scripts で別途対応してください。
        </p>
        <div className="overflow-x-auto rounded-lg border border-zinc-800 bg-zinc-900/30">
          <table className="min-w-full text-left">
            <thead className="text-xs text-zinc-500">
              <tr className="border-b border-zinc-800">
                <th className="px-3 py-2 font-medium">内容</th>
                <th className="px-3 py-2 font-medium">申請者</th>
                <th className="px-3 py-2 font-medium">日時</th>
                <th className="px-3 py-2 text-right font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {contributions.length === 0 ? (
                <tr>
                  <td
                    colSpan={4}
                    className="px-3 py-6 text-center text-sm text-zinc-500"
                  >
                    未処理の申請はありません。
                  </td>
                </tr>
              ) : (
                contributions.map((contribution) => (
                  <AdminContributionRowItem
                    key={contribution.id}
                    contribution={contribution}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mb-10">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-lg font-semibold text-zinc-100">セッション管理</h2>
          <p className="text-xs text-zinc-500">最新 {threads.length} 件</p>
        </div>
        <div className="overflow-x-auto rounded-lg border border-zinc-800 bg-zinc-900/30">
          <table className="min-w-full text-left">
            <thead className="text-xs text-zinc-500">
              <tr className="border-b border-zinc-800">
                <th className="px-3 py-2 font-medium">セッション</th>
                <th className="px-3 py-2 text-right font-medium">閲覧</th>
                <th className="px-3 py-2 text-right font-medium">返信</th>
                <th className="px-3 py-2 text-right font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {threads.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-3 py-6 text-center text-sm text-zinc-500">
                    セッションがありません。
                  </td>
                </tr>
              ) : (
                threads.map((thread) => (
                  <AdminThreadRowItem key={thread.id} thread={thread} />
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-lg font-semibold text-zinc-100">ユーザー管理</h2>
          <p className="text-xs text-zinc-500">最新 {users.length} 件</p>
        </div>
        <div className="overflow-x-auto rounded-lg border border-zinc-800 bg-zinc-900/30">
          <table className="min-w-full text-left">
            <thead className="text-xs text-zinc-500">
              <tr className="border-b border-zinc-800">
                <th className="px-3 py-2 font-medium">ユーザー</th>
                <th className="px-3 py-2 text-center font-medium">権限</th>
                <th className="px-3 py-2 text-right font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {users.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-3 py-6 text-center text-sm text-zinc-500">
                    ユーザーがいません。
                  </td>
                </tr>
              ) : (
                users.map((row) => (
                  <AdminUserRowItem key={row.id} user={row} selfId={user.id} />
                ))
              )}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-zinc-500">
          ユーザー一覧の取得には Supabase の Service Role キーが必要です（
          <code className="rounded bg-zinc-800 px-1">SUPABASE_SERVICE_ROLE_KEY</code>{" "}
          を <code>.env.local</code> に設定してください）。
        </p>
      </section>
    </div>
  );
}
