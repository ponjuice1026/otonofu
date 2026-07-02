import Link from "next/link";
import { Logo } from "@/components/layout/Logo";
import { SITE_TAGLINE } from "@/lib/site";

export function Footer() {
  return (
    <footer className="site-footer mt-auto">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-6 px-4 py-8 sm:flex-row sm:justify-between sm:px-6 md:py-10">
        <div className="flex items-center gap-3">
          <Logo size="sm" withWordmark={false} />
          <div>
            <p className="font-display text-sm font-semibold tracking-tight text-neutral-200">
              オトノフ
            </p>
            <p className="text-xs text-neutral-500">{SITE_TAGLINE}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-neutral-500">
          <Link href="/threads" className="transition hover:text-neutral-300">
            セッション
          </Link>
          <Link href="/charts" className="transition hover:text-neutral-300">
            ランキング
          </Link>
          <Link href="/albums" className="transition hover:text-neutral-300">
            アルバム
          </Link>
        </div>
      </div>
    </footer>
  );
}
