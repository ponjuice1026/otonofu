"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  MOBILE_NAV_ITEMS,
  mobileNavHref,
  type MobileNavItem,
} from "@/lib/site-nav";

type MobileBottomNavProps = {
  loggedIn: boolean;
  avatarUrl?: string;
  accountLabel?: string;
};

function NavIcon({ id, active }: { id: MobileNavItem["id"]; active: boolean }) {
  const className = active
    ? "mobile-bottom-nav__icon mobile-bottom-nav__icon--active"
    : "mobile-bottom-nav__icon";

  switch (id) {
    case "home":
      return (
        <svg aria-hidden className={className} viewBox="0 0 24 24" fill="none">
          <path
            d="M4 10.5 12 4l8 6.5V19a1.5 1.5 0 0 1-1.5 1.5H15v-5.5h-6V20.5H5.5A1.5 1.5 0 0 1 4 19v-8.5Z"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
        </svg>
      );
    case "threads":
      return (
        <svg aria-hidden className={className} viewBox="0 0 24 24" fill="none">
          <path
            d="M5 6.5h14M5 12h10M5 17.5h8"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
          <path
            d="M17.5 11.5 20 14l-2.5 2.5"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
    case "create":
      return (
        <span className="mobile-bottom-nav__create-mark" aria-hidden>
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none">
            <path
              d="M12 5v14M5 12h14"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        </span>
      );
    case "charts":
      return (
        <svg aria-hidden className={className} viewBox="0 0 24 24" fill="none">
          <path
            d="M6 18V10M12 18V6M18 18v-4"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </svg>
      );
    case "account":
      return (
        <svg aria-hidden className={className} viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="8.5" r="3.25" stroke="currentColor" strokeWidth="1.6" />
          <path
            d="M6.5 19c.9-2.45 3-4 5.5-4s4.6 1.55 5.5 4"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </svg>
      );
  }
}

export function MobileBottomNav({
  loggedIn,
  avatarUrl,
  accountLabel = "マイ",
}: MobileBottomNavProps) {
  const pathname = usePathname();

  return (
    <nav
      className="mobile-bottom-nav md:hidden"
      aria-label="モバイルメイン"
    >
      <div className="mobile-bottom-nav__inner">
        {MOBILE_NAV_ITEMS.map((item) => {
          const active = item.match(pathname);
          const href = mobileNavHref(item.id, loggedIn);
          const label = item.id === "account" ? accountLabel : item.label;
          const isCreate = item.id === "create";

          return (
            <Link
              key={item.id}
              href={href}
              aria-current={active ? "page" : undefined}
              className={
                isCreate
                  ? active
                    ? "mobile-bottom-nav__link mobile-bottom-nav__link--create mobile-bottom-nav__link--create-active"
                    : "mobile-bottom-nav__link mobile-bottom-nav__link--create"
                  : active
                    ? item.featured
                      ? "mobile-bottom-nav__link mobile-bottom-nav__link--active mobile-bottom-nav__link--featured"
                      : "mobile-bottom-nav__link mobile-bottom-nav__link--active"
                    : item.featured
                      ? "mobile-bottom-nav__link mobile-bottom-nav__link--featured"
                      : "mobile-bottom-nav__link"
              }
            >
              {item.id === "account" && loggedIn && avatarUrl ? (
                <span className="mobile-bottom-nav__avatar-wrap">
                  <Image
                    src={avatarUrl}
                    alt=""
                    width={24}
                    height={24}
                    className="mobile-bottom-nav__avatar"
                    unoptimized
                  />
                </span>
              ) : (
                <NavIcon id={item.id} active={active} />
              )}
              <span className="mobile-bottom-nav__label">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
