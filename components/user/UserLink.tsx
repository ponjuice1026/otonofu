import Link from "next/link";

type UserLinkProps = {
  /** プロフィールが公開されているユーザーID。匿名投稿では undefined/null */
  userId?: string | null;
  name: string;
  className?: string;
};

/**
 * 投稿者名を公開ユーザーページ（/users/[id]）へのリンクとして描画する。
 * userId が無い場合（匿名投稿）はリンクにせず、素のテキストを返す。
 */
export function UserLink({ userId, name, className }: UserLinkProps) {
  if (!userId) {
    return <span className={className}>{name}</span>;
  }

  return (
    <Link
      href={`/users/${userId}`}
      className={className}
      style={{ textDecoration: "none" }}
    >
      {name}
    </Link>
  );
}
