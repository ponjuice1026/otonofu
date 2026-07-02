"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { HEADER_NAV_ITEMS } from "@/lib/site-nav";

export function NavLinks() {
  const pathname = usePathname();

  return (
    <nav className="hidden md:flex flex-wrap gap-0.5" aria-label="メイン">
      {HEADER_NAV_ITEMS.map((item) => {
        const active = item.match(pathname);
        const className = active
          ? item.featured
            ? "nav-link nav-link-active nav-link-featured"
            : "nav-link nav-link-active"
          : item.featured
            ? "nav-link nav-link-featured"
            : "nav-link";

        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={className}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
