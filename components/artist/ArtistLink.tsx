import Link from "next/link";
import { getArtistName } from "@/lib/data/artists";

type ArtistLinkProps = {
  artistId: string;
  className?: string;
  /** 親で取得済みの名前（DB 参照を省略） */
  name?: string;
};

export async function ArtistLink({
  artistId,
  className = "",
  name,
}: ArtistLinkProps) {
  const displayName = name ?? (await getArtistName(artistId));

  return (
    <Link
      href={`/artists/${artistId}`}
      className={`hover:text-amber-400 ${className}`}
    >
      {displayName}
    </Link>
  );
}
