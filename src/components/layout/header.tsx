"use client";

import { signOut, useSession } from "next-auth/react";
import { usePathname, useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { ADMIN_NAV_ITEMS, APP_NAV_ITEMS, getActiveNavHref, PAGE_TITLES, type NavItem } from "@/components/layout/navigation";
import {
  LogOut,
  Mail,
  Menu,
  Settings,
  User,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { LOCALE_COOKIE, type Locale } from "@/i18n/config";

interface HeaderProps {
  isAdmin?: boolean;
}

export function Header({ isAdmin = false }: HeaderProps) {
  const { data: session } = useSession();
  const pathname = usePathname();
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Prevent hydration mismatch with Radix UI components
  useEffect(() => {
    setMounted(true);
  }, []);

  const userNavItems = APP_NAV_ITEMS.filter((item) => !item.adminOnly || isAdmin);
  const activeHref = getActiveNavHref(pathname, [...userNavItems, ...(isAdmin ? ADMIN_NAV_ITEMS : [])]);

  // Get page info based on pathname
  const getPageInfo = () => {
    // Check exact match first
    if (PAGE_TITLES[pathname]) return PAGE_TITLES[pathname];
    // Check prefix match for nested routes
    const basePath = "/" + pathname.split("/")[1];
    return PAGE_TITLES[basePath] || null;
  };

  const pageInfo = getPageInfo();

  const initials = session?.user?.name
    ? session.user.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
    : session?.user?.email?.[0].toUpperCase() || "U";

  const setLocale = (nextLocale: Locale) => {
    if (nextLocale === locale) return;
    try {
      document.cookie = `${LOCALE_COOKIE}=${nextLocale}; Path=/; Max-Age=31536000; SameSite=Lax`;
    } catch {
      // ignore
    }
    router.refresh();
  };

  const renderNavItem = (item: NavItem) => {
    const isActive = item.href === activeHref;
    return (
      <Link
        key={item.href}
        href={item.href}
        onClick={() => setMobileMenuOpen(false)}
        className={cn(
          "flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg transition-colors",
          isActive
            ? "bg-primary text-primary-foreground"
            : "text-muted-foreground hover:bg-accent hover:text-foreground"
        )}
      >
        <item.icon className="h-5 w-5" />
        {t(item.titleKey)}
      </Link>
    );
  };

  return (
    <header className="sticky top-0 z-40 bg-white border-b">
      <div className="flex h-14 items-center justify-between px-4 md:px-6">
        <div className="flex items-center gap-3">
          {/* Mobile Menu Button */}
          {mounted ? (
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="md:hidden">
                  <Menu className="h-5 w-5" />
                  <span className="sr-only">{t("layout.toggleMenu")}</span>
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-72 p-0 flex flex-col overflow-hidden">
                <SheetHeader className="p-4 border-b">
                  <SheetTitle className="flex items-center gap-2">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <Mail className="h-5 w-5 text-primary" />
                    </div>
                    <span className="text-xl font-bold">{t("common.appName")}</span>
                  </SheetTitle>
                </SheetHeader>
                <nav className="flex-1 min-h-0 overflow-y-auto p-4 space-y-1">
                  {userNavItems.map(renderNavItem)}

                  {isAdmin && (
                    <>
                      <div className="pt-4 pb-2">
                        <p className="px-3 text-xs font-semibold text-muted-foreground/60 uppercase tracking-wider">
                          {t("layout.administration")}
                        </p>
                      </div>
                      {ADMIN_NAV_ITEMS.map(renderNavItem)}
                    </>
                  )}
                </nav>
              </SheetContent>
            </Sheet>
          ) : (
            <Button variant="ghost" size="icon" className="md:hidden">
              <Menu className="h-5 w-5" />
              <span className="sr-only">{t("layout.toggleMenu")}</span>
            </Button>
          )}

          <div className="md:hidden">
            <span className="text-xl font-bold">{t("common.appName")}</span>
          </div>
          {pageInfo && (
            <div className="hidden md:block">
              <h1 className="text-lg font-semibold">{t(pageInfo.titleKey)}</h1>
            </div>
          )}
        </div>

        {mounted ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-10 w-10 rounded-full">
                <Avatar className="h-10 w-10">
                  <AvatarFallback className="bg-primary text-primary-foreground">
                    {initials}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="end">
              <DropdownMenuLabel>
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium">{session?.user?.name || t("layout.user")}</p>
                  <p className="text-xs text-muted-foreground">{session?.user?.email}</p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/settings" className="cursor-pointer">
                  <User className="mr-2 h-4 w-4" />
                  {t("layout.profile")}
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/settings" className="cursor-pointer">
                  <Settings className="mr-2 h-4 w-4" />
                  {t("nav.settings")}
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>{t("layout.language")}</DropdownMenuLabel>
              <DropdownMenuItem onSelect={() => setLocale("en")}>
                {t("locales.en")}{locale === "en" ? " ✓" : ""}
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setLocale("zh")}>
                {t("locales.zh")}{locale === "zh" ? " ✓" : ""}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="cursor-pointer text-red-600"
                onClick={() => signOut({ callbackUrl: "/login" })}
              >
                <LogOut className="mr-2 h-4 w-4" />
                {t("auth.logout")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <Button variant="ghost" className="relative h-10 w-10 rounded-full">
            <Avatar className="h-10 w-10">
              <AvatarFallback className="bg-primary text-primary-foreground">
                {initials}
              </AvatarFallback>
            </Avatar>
          </Button>
        )}
      </div>
    </header>
  );
}
