import Image from "next/image";
import Link from "next/link";
import type { FollowUser } from "@/lib/data/follows";

function displayNameOf(user: FollowUser): string {
  return user.displayName?.trim() || user.username;
}

function initialFor(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "?";
  const cp = trimmed.codePointAt(0);
  return cp ? String.fromCodePoint(cp) : "?";
}

type Props = {
  users: FollowUser[];
  emptyMessage: string;
};

export function FollowUserList({ users, emptyMessage }: Props) {
  if (users.length === 0) {
    return <p className="text-sm text-neutral-500">{emptyMessage}</p>;
  }

  return (
    <ul className="flex flex-col gap-2">
      {users.map((user) => {
        const name = displayNameOf(user);
        return (
          <li key={user.id}>
            <Link
              href={`/users/${user.id}`}
              className="card-interactive flex items-center gap-3 px-4 py-3"
            >
              <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-full border border-[var(--border-strong)] bg-[var(--surface-raised)]">
                {user.avatarUrl ? (
                  <Image
                    src={user.avatarUrl}
                    alt={name}
                    fill
                    className="object-cover"
                    sizes="44px"
                    unoptimized
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-lg font-bold text-zinc-400">
                    {initialFor(name)}
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="line-clamp-1 font-semibold text-neutral-100">
                  {name}
                </p>
                <p className="text-xs text-neutral-500">@{user.username}</p>
                {user.bio?.trim() && (
                  <p className="mt-1 line-clamp-1 text-sm text-neutral-500">
                    {user.bio}
                  </p>
                )}
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
