import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      // アルバム一覧は /charts の「新着順」タブに統合した。
      // /albums/[id] は残るので、完全一致のみリダイレクトする。
      {
        source: "/albums",
        destination: "/charts?sort=newest",
        permanent: true,
      },
    ];
  },
  images: {
    // Vercel の画像最適化クォータを超過すると _next/image が 402 を返し、
    // 全ページの画像（アルバムカバー・アーティスト画像・アバター等）が
    // 一斉に読み込み失敗する。最適化をバイパスし、元画像（Spotify /
    // Supabase の CDN）を直接配信してクォータ非依存にする。元画像は
    // CDN 側で適切なサイズが配られるため実害は小さい。
    unoptimized: true,
    qualities: [75, 90],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "i.scdn.co",
        pathname: "/image/**",
      },
      {
        protocol: "https",
        hostname: "mosaic.scdn.co",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "image-cdn-ak.spotifycdn.com",
        pathname: "/image/**",
      },
      {
        protocol: "https",
        hostname: "image-cdn-fa.spotifycdn.com",
        pathname: "/image/**",
      },
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
};

export default nextConfig;
