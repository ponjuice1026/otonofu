import Link from "next/link";
import type { ThreadCategory } from "@/lib/types";

type ThreadCategoryNavProps = {
  categories: ThreadCategory[];
  /** 現在選択中のカテゴリ slug。未選択（すべて）は null。 */
  activeSlug: string | null;
};

/** セッション一覧のカテゴリ（板）チップ。?category=slug で絞り込む。 */
export function ThreadCategoryNav({
  categories,
  activeSlug,
}: ThreadCategoryNavProps) {
  if (categories.length === 0) return null;

  const chipClass = (active: boolean) =>
    active
      ? "rounded-full border border-[var(--brand-amber)] bg-[var(--brand-amber-soft)] px-3 py-1.5 text-sm font-medium text-[var(--foreground)]"
      : "rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-sm text-[var(--muted-foreground)] transition hover:border-[var(--border-strong)]";

  return (
    <nav className="mb-6 flex flex-wrap gap-2" aria-label="カテゴリ">
      <Link href="/threads" className={chipClass(activeSlug === null)}>
        すべて
      </Link>
      {categories.map((category) => (
        <Link
          key={category.id}
          href={`/threads?category=${category.slug}`}
          className={chipClass(activeSlug === category.slug)}
        >
          {category.name}
        </Link>
      ))}
    </nav>
  );
}
