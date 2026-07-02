import type { Album } from "@/lib/types";

const releaseTypeLabel: Record<Album["type"], string> = {
  album: "アルバム",
  ep: "EP",
  compilation: "コンピレーション",
};

export function getReleaseTypeLabel(type: Album["type"]): string {
  return releaseTypeLabel[type];
}
