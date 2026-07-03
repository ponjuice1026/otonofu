import Image from "next/image";

type CoverItem = {
  albumId: string;
  coverUrl?: string;
  coverColor: string;
  spotifyId?: string;
};

type ListCoverCollageProps = {
  items: CoverItem[];
  className?: string;
};

function coverSrc(item: CoverItem): string | undefined {
  if (item.coverUrl) return item.coverUrl;
  if (item.spotifyId) return `/api/covers/album/${item.spotifyId}`;
  return undefined;
}

/**
 * リスト一覧カード用のカバーコラージュ。
 * 先頭最大4件を 2x2 グリッドで表示。空きは coverColor / プレースホルダで埋める。
 */
export function ListCoverCollage({ items, className }: ListCoverCollageProps) {
  const cells = Array.from({ length: 4 }, (_, i) => items[i]);

  return (
    <div
      className={`grid aspect-square w-full grid-cols-2 grid-rows-2 overflow-hidden rounded-md bg-zinc-900 ${className ?? ""}`}
    >
      {cells.map((item, index) => {
        if (!item) {
          return (
            <div
              key={`empty-${index}`}
              className="bg-zinc-800/60"
              aria-hidden
            />
          );
        }
        const src = coverSrc(item);
        return (
          <div
            key={item.albumId}
            className="relative overflow-hidden"
            style={{ backgroundColor: item.coverColor }}
          >
            {src ? (
              <Image
                src={src}
                alt=""
                fill
                className="object-cover"
                sizes="120px"
                unoptimized
              />
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
