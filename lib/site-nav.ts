export type SiteNavItem = {
  href: string;
  label: string;
  featured?: boolean;
  match: (pathname: string) => boolean;
};

export const HEADER_NAV_ITEMS: SiteNavItem[] = [
  {
    href: "/threads",
    label: "セッション",
    featured: true,
    match: (path) =>
      path.startsWith("/threads") && !path.startsWith("/threads/new"),
  },
  {
    href: "/albums",
    label: "アルバム",
    match: (path) => path.startsWith("/albums"),
  },
  {
    href: "/genres",
    label: "ジャンル",
    match: (path) => path.startsWith("/genres"),
  },
  {
    href: "/charts",
    label: "ランキング",
    match: (path) => path.startsWith("/charts"),
  },
];

export type MobileNavItem = {
  id: "home" | "threads" | "create" | "charts" | "account";
  label: string;
  featured?: boolean;
  match: (pathname: string) => boolean;
};

export const MOBILE_NAV_ITEMS: MobileNavItem[] = [
  {
    id: "home",
    label: "ホーム",
    match: (path) => path === "/",
  },
  {
    id: "threads",
    label: "セッション",
    featured: true,
    match: (path) =>
      path.startsWith("/threads") && !path.startsWith("/threads/new"),
  },
  {
    id: "create",
    label: "作成",
    featured: true,
    match: (path) => path.startsWith("/threads/new"),
  },
  {
    id: "charts",
    label: "ランキング",
    match: (path) => path.startsWith("/charts"),
  },
  {
    id: "account",
    label: "マイ",
    match: (path) =>
      path.startsWith("/profile") ||
      path.startsWith("/login") ||
      path.startsWith("/admin"),
  },
];

export function mobileNavHref(
  id: MobileNavItem["id"],
  loggedIn: boolean,
): string {
  switch (id) {
    case "home":
      return "/";
    case "threads":
      return "/threads";
    case "create":
      return loggedIn ? "/threads/new" : "/login?redirect=/threads/new";
    case "charts":
      return "/charts";
    case "account":
      return loggedIn ? "/profile" : "/login";
  }
}
