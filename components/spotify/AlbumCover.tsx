import Image from "next/image";

type AlbumCoverProps = {
  imageUrl?: string | null;
  fallbackColor: string;
  title: string;
  size?: "xs" | "sm" | "lg" | "card" | "hero";
};

export function AlbumCover({
  imageUrl,
  fallbackColor,
  title,
  size = "lg",
}: AlbumCoverProps) {
  const sizeClass =
    size === "hero"
      ? "w-full max-w-[260px] sm:max-w-[300px]"
      : size === "lg"
        ? "max-w-xs"
        : size === "card"
          ? "w-full"
          : size === "xs"
            ? "h-10 w-10"
            : "h-14 w-14";

  const roundedClass = size === "hero" ? "rounded-xl" : "rounded-md";

  if (imageUrl) {
    return (
      <div
        className={`relative aspect-square shrink-0 overflow-hidden bg-zinc-800 shadow-lg ${roundedClass} ${sizeClass}`}
      >
        <Image
          src={imageUrl}
          alt={title}
          fill
          className="object-cover"
          sizes={
            size === "hero"
              ? "(max-width: 640px) 260px, 300px"
              : size === "lg"
                ? "320px"
                : size === "card"
                  ? "(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 256px"
                  : size === "xs"
                    ? "40px"
                    : "56px"
          }
          quality={90}
          priority={size === "hero"}
        />
      </div>
    );
  }

  return (
    <div
      className={`aspect-square shrink-0 rounded-lg ${sizeClass}`}
      style={{ backgroundColor: fallbackColor }}
      aria-hidden
    />
  );
}
