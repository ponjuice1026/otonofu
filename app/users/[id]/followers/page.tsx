import Link from "next/link";
import { notFound } from "next/navigation";
import { getProfile } from "@/lib/auth/profile";
import { getFollowers } from "@/lib/data/follows";
import { FollowUserList } from "@/components/profile/FollowUserList";
import { pageTitle } from "@/lib/site";

type PageProps = {
  params: Promise<{ id: string }>;
};

export const dynamic = "force-dynamic";

function profileDisplayName(profile: {
  display_name: string | null;
  username: string;
}): string {
  return profile.display_name?.trim() || profile.username;
}

export async function generateMetadata({ params }: PageProps) {
  const { id } = await params;
  const profile = await getProfile(id);
  const name = profile ? profileDisplayName(profile) : "ユーザー";
  return { title: pageTitle(`${name} のフォロワー`) };
}

export default async function FollowersPage({ params }: PageProps) {
  const { id } = await params;
  const profile = await getProfile(id);

  if (!profile) {
    notFound();
  }

  const displayName = profileDisplayName(profile);
  const followers = await getFollowers(id);

  return (
    <div className="page-shell mx-auto max-w-2xl">
      <header className="page-header">
        <p className="text-sm text-neutral-500">
          <Link href={`/users/${id}`} className="hover:text-neutral-200">
            {displayName}
          </Link>
        </p>
        <h1 className="page-title">フォロワー</h1>
      </header>

      <FollowUserList
        users={followers}
        emptyMessage="まだフォロワーがいません。"
      />
    </div>
  );
}
