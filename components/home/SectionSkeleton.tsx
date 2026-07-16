type Props = {
  /** カード枠の数 */
  cards?: number;
  /** カバー画像＋テキスト行のカード風にするか（レビュー/アルバム向け） */
  layout?: "row" | "grid";
};

/**
 * ストリーミング中セクションのフォールバック。実データ到着まで
 * 高さを確保してレイアウトシフトを抑える最小のプレースホルダ。
 */
export function SectionSkeleton({ cards = 3, layout = "row" }: Props) {
  return (
    <section className="home-section mb-14" aria-hidden>
      <div className="section-header">
        <div className="space-y-2">
          <div className="h-6 w-48 animate-pulse rounded bg-neutral-800" />
          <div className="h-4 w-64 animate-pulse rounded bg-neutral-900" />
        </div>
      </div>
      <div
        className={
          layout === "grid"
            ? "grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-5"
            : "grid gap-4 sm:grid-cols-2"
        }
      >
        {Array.from({ length: cards }).map((_, i) => (
          <div
            key={i}
            className="h-40 animate-pulse rounded-xl bg-neutral-900"
          />
        ))}
      </div>
    </section>
  );
}
