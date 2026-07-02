type TrackListProps = {
  tracks: { number: number; name: string; duration: string }[];
  spotifyUrl?: string | null;
};

export function SpotifyTrackList({ tracks, spotifyUrl }: TrackListProps) {
  if (tracks.length === 0) return null;

  return (
    <section className="mt-10">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-zinc-100">トラックリスト</h2>
        {spotifyUrl && (
          <a
            href={spotifyUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-amber-400 hover:underline"
          >
            Spotify で聴く →
          </a>
        )}
      </div>
      <ol className="divide-y divide-zinc-800 rounded-lg border border-zinc-800">
        {tracks.map((track) => (
          <li
            key={`${track.number}-${track.name}`}
            className="flex items-center justify-between px-4 py-3 text-sm"
          >
            <div className="flex items-center gap-4">
              <span className="w-6 text-right font-mono text-zinc-500">
                {track.number}
              </span>
              <span className="text-zinc-100">{track.name}</span>
            </div>
            <span className="text-zinc-500">{track.duration}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
