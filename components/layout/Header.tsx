import { HeaderAuth } from "@/components/layout/HeaderAuth";
import { NotificationBell } from "@/components/layout/NotificationBell";
import { Logo } from "@/components/layout/Logo";
import { NavLinks } from "@/components/layout/NavLinks";
import { SearchAutocomplete } from "@/components/layout/SearchAutocomplete";
import { ThreadCreateLink } from "@/components/layout/ThreadCreateLink";
import { getUser } from "@/lib/auth/session";

export async function Header() {
  const user = await getUser();

  return (
    <header className="site-header sticky top-0 z-50">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-3 sm:px-6">
        <div className="flex items-center gap-3 md:hidden">
          <Logo size="sm" />
          <div className="min-w-0 flex-1">
            <SearchAutocomplete />
          </div>
        </div>

        <div className="hidden md:flex md:flex-col md:gap-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-6">
              <Logo />
              <div
                className="hidden h-5 w-px bg-[var(--border)] sm:block"
                aria-hidden
              />
              <NavLinks loggedIn={Boolean(user)} />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <ThreadCreateLink />
              <NotificationBell />
              <HeaderAuth />
            </div>
          </div>
          <SearchAutocomplete />
        </div>
      </div>
    </header>
  );
}
