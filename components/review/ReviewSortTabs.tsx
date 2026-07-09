import Link from "next/link";
import {
  REVIEW_SORT_OPTIONS,
  reviewsPageHref,
  type ReviewSort,
} from "@/lib/reviews/review-sort";

type ReviewSortTabsProps = {
  albumId: string;
  sort: ReviewSort;
};

export function ReviewSortTabs({ albumId, sort }: ReviewSortTabsProps) {
  const basePath = `/albums/${albumId}`;

  return (
    <div className="tab-group flex-wrap">
      {REVIEW_SORT_OPTIONS.map((option) => (
        <Link
          key={option.value}
          href={reviewsPageHref(basePath, {
            reviewSort: option.value,
            hash: "reviews",
          })}
          scroll={false}
          prefetch={false}
          aria-current={sort === option.value ? "page" : undefined}
          className={
            sort === option.value ? "tab-item tab-item-active" : "tab-item"
          }
        >
          {option.label}
        </Link>
      ))}
    </div>
  );
}
