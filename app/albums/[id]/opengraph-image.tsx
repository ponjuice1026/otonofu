import { ImageResponse } from "next/og";
import { getAlbumById } from "@/lib/data/albums";
import { albumCoverSrc } from "@/lib/covers";
import { siteUrl } from "@/lib/site";

export const alt = "オトノフ";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

type Props = { params: Promise<{ id: string }> };

export default async function Image({ params }: Props) {
  const { id } = await params;
  const album = await getAlbumById(id);

  const coverSrc = album ? albumCoverSrc(album) : undefined;
  const cover = coverSrc
    ? coverSrc.startsWith("http")
      ? coverSrc
      : siteUrl(coverSrc)
    : null;
  const logo = siteUrl("/brand/otonofu-icon.png");
  const rating =
    album && album.ratingCount > 0 ? album.avgRating.toFixed(1) : null;
  const reviewLabel =
    album && album.ratingCount > 0
      ? `${album.ratingCount.toLocaleString("en-US")} reviews`
      : "Review & Rate music";

  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          width: "100%",
          height: "100%",
          background: "#0a0a0c",
        }}
      >
        {cover ? (
          <img
            src={cover}
            alt=""
            width={630}
            height={630}
            style={{ width: 630, height: 630, objectFit: "cover" }}
          />
        ) : (
          <div
            style={{
              display: "flex",
              width: 630,
              height: 630,
              alignItems: "center",
              justifyContent: "center",
              background: "#141418",
            }}
          >
            <img src={logo} alt="" width={260} height={260} />
          </div>
        )}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            flex: 1,
            padding: 56,
            justifyContent: "space-between",
            background: "linear-gradient(135deg, #17171d 0%, #0a0a0c 100%)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
            <img src={logo} alt="" width={68} height={68} />
            <span style={{ fontSize: 48, fontWeight: 700, color: "#f5f5f8" }}>
              otonofu
            </span>
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            {rating ? (
              <div style={{ display: "flex", alignItems: "flex-end", gap: 14 }}>
                <span
                  style={{
                    fontSize: 128,
                    fontWeight: 800,
                    color: "#f5f5f8",
                    lineHeight: 1,
                  }}
                >
                  {rating}
                </span>
                <span
                  style={{ fontSize: 46, color: "#8a8fa5", paddingBottom: 16 }}
                >
                  / 10
                </span>
              </div>
            ) : (
              <span style={{ fontSize: 60, fontWeight: 700, color: "#f5f5f8" }}>
                Review &amp; Rate
              </span>
            )}
            <span style={{ fontSize: 30, color: "#8a8fa5", marginTop: 10 }}>
              {reviewLabel}
            </span>
          </div>
          <span style={{ fontSize: 24, color: "#6b7089", letterSpacing: 3 }}>
            MUSIC SESSION COMMUNITY
          </span>
        </div>
      </div>
    ),
    { ...size },
  );
}
