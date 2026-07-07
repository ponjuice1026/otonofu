import { ImageResponse } from "next/og";
import { getArtistById } from "@/lib/data/artists";
import { artistImageSrc } from "@/lib/covers";
import { siteUrl } from "@/lib/site";

export const alt = "オトノフ";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

type Props = { params: Promise<{ id: string }> };

export default async function Image({ params }: Props) {
  const { id } = await params;
  const artist = await getArtistById(id);

  const imageSrc = artist ? artistImageSrc(artist) : undefined;
  const image = imageSrc
    ? imageSrc.startsWith("http")
      ? imageSrc
      : siteUrl(imageSrc)
    : null;
  const logo = siteUrl("/brand/otonofu-icon.png");

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
        {image ? (
          <img
            src={image}
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
            <span style={{ fontSize: 60, fontWeight: 800, color: "#f5f5f8" }}>
              Artist
            </span>
            <span style={{ fontSize: 30, color: "#8a8fa5", marginTop: 10 }}>
              Discography &amp; Reviews
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
