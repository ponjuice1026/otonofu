export type AlbumCoverInfo = {
  coverUrl?: string;
  spotifyId?: string;
  coverColor?: string;
};

export function buildReviewCardCoverProps(
  albumId: string,
  albumCovers: Map<string, AlbumCoverInfo>,
): { albumCoverUrl?: string; albumCoverColor: string } {
  const cover = albumCovers.get(albumId);
  const albumCoverUrl =
    cover?.coverUrl ??
    (cover?.spotifyId ? `/api/covers/album/${cover.spotifyId}` : undefined);

  return {
    albumCoverUrl,
    albumCoverColor: cover?.coverColor ?? "#262626",
  };
}
