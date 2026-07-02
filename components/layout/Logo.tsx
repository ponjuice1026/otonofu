import Image from "next/image";
import Link from "next/link";

type LogoProps = {
  size?: "sm" | "md" | "lg";
  withWordmark?: boolean;
};

const SIZE_MAP = {
  sm: { box: 28, text: "text-base" },
  md: { box: 36, text: "text-xl" },
  lg: { box: 48, text: "text-2xl" },
} as const;

export function Logo({ size = "md", withWordmark = true }: LogoProps) {
  const dims = SIZE_MAP[size];

  return (
    <Link
      href="/"
      className="group inline-flex shrink-0 items-center gap-3"
      aria-label="オトノフ ホーム"
    >
      <span className="logo-mark transition duration-300 group-hover:brightness-110">
        <span className="logo-mark__inner block">
          <Image
            src="/brand/otonofu-icon.png?v=3"
            alt=""
            width={dims.box}
            height={dims.box}
            unoptimized
            priority
          />
        </span>
      </span>

      {withWordmark && (
        <span className="flex flex-col leading-none">
          <span
            className={`font-display ${dims.text} font-bold tracking-tight text-foreground`}
          >
            オトノフ
          </span>
          <span className="font-display mt-1 hidden text-[10px] font-semibold uppercase tracking-[0.42em] text-neutral-500 sm:block">
            Otonofu
          </span>
        </span>
      )}
    </Link>
  );
}
