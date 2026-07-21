import Link from "next/link";
import { Logo } from "@/components/layout/Logo";
import { SITE_TAGLINE } from "@/lib/site";
import { SITE_INFO_LINKS, SITE_SERVICE_LINKS } from "@/lib/site-legal";

const currentYear = new Date().getFullYear();

export function Footer() {
  return (
    <footer className="site-footer mt-auto">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <div className="flex flex-col gap-8 sm:flex-row sm:justify-between">
          <div className="flex items-center gap-3">
            <Logo size="sm" withWordmark={false} />
            <div>
              <p className="font-display text-sm font-semibold tracking-tight text-neutral-200">
                オトノフ
              </p>
              <p className="text-xs text-neutral-500">{SITE_TAGLINE}</p>
            </div>
          </div>

          <nav
            aria-label="フッターナビゲーション"
            className="grid grid-cols-2 gap-x-8 gap-y-6 sm:gap-x-12"
          >
            <div>
              <p className="mb-2.5 text-xs font-semibold tracking-wide text-neutral-400">
                さがす
              </p>
              <ul className="flex flex-col gap-2 text-xs text-neutral-500">
                {SITE_SERVICE_LINKS.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="transition hover:text-neutral-300"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <p className="mb-2.5 text-xs font-semibold tracking-wide text-neutral-400">
                サイト情報
              </p>
              <ul className="flex flex-col gap-2 text-xs text-neutral-500">
                {SITE_INFO_LINKS.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="transition hover:text-neutral-300"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </nav>
        </div>

        <p className="mt-8 border-t border-white/5 pt-6 text-xs text-neutral-600">
          © {currentYear} オトノフ
        </p>
      </div>
    </footer>
  );
}
