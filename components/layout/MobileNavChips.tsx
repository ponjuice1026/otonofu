"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MOBILE_NAV_CHIP_ITEMS } from "@/lib/site-nav";

type MobileNavChipsProps = {
  loggedIn?: boolean;
};

export function MobileNavChips({ loggedIn = false }: MobileNavChipsProps) {
  const pathname = usePathname();
  const items = MOBILE_NAV_CHIP_ITEMS.filter(
    (item) => !item.requiresAuth || loggedIn,
  );

  return (
    <nav className="mobile-nav-chips md:hidden" aria-label="モバイルナビゲーション">
      <ul className="mobile-nav-chips__list">
        {items.map((item) => {
          const active = item.match(pathname);

          return (
            <li key={item.href} className="mobile-nav-chips__item">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={
                  active
                    ? "mobile-nav-chip mobile-nav-chip--active"
                    : "mobile-nav-chip"
                }
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
