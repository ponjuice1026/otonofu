import Link from "next/link";
import { Logo } from "@/components/layout/Logo";
import { SITE_TAGLINE } from "@/lib/site";
import { SITE_INFO_LINKS, SITE_SERVICE_LINKS } from "@/lib/site-legal";

const currentYear = new Date().getFullYear();

type FooterLinkGroupProps = {
  label: string;
  links: { href: string; label: string }[];
};

function FooterLinkGroup({ label, links }: FooterLinkGroupProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-[0.6875rem] font-semibold uppercase tracking-wider text-neutral-500">
        {label}
      </p>
      <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-neutral-500">
        {links.map((link) => (
          <li key={link.href}>
            <Link href={link.href} className="transition hover:text-neutral-300">
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Footer() {
  return (
    <footer className="site-footer mt-auto">
      <div className="mx-auto max-w-6xl px-4 py-7 sm:px-6">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
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
            className="flex flex-col gap-5 sm:items-end sm:text-right"
          >
            <FooterLinkGroup label="さがす" links={SITE_SERVICE_LINKS} />
            <FooterLinkGroup label="サイト情報" links={SITE_INFO_LINKS} />
          </nav>
        </div>

        <p className="mt-6 border-t border-white/5 pt-5 text-xs text-neutral-600">
          © {currentYear} オトノフ
        </p>
      </div>
    </footer>
  );
}
