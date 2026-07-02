import type { Album } from "@/lib/types";

export type ArtistDiscographySections = {
  discography: Album[];
  otherReleases: Album[];
};

/** 同年内はタイトル順、全体はリリース年の古い順 */
export function sortAlbumsByReleaseOrder(albums: Album[]): Album[] {
  return [...albums].sort((a, b) => {
    if (a.year !== b.year) return a.year - b.year;
    return a.title.localeCompare(b.title, "ja");
  });
}

/** スタジオアルバム（type: album）とそれ以外に分割 */
export function splitArtistDiscography(releases: Album[]): ArtistDiscographySections {
  const discography = sortAlbumsByReleaseOrder(
    releases.filter((release) => release.type === "album"),
  );
  const otherReleases = sortAlbumsByReleaseOrder(
    releases.filter((release) => release.type !== "album"),
  );

  return { discography, otherReleases };
}
