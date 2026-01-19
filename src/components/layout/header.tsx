"use client";

import { signOut, useSession } from "next-auth/react";
import { usePathname } from "next/navigation";
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
import {
  Cog,
  FileText,
  Forward,
  Globe,
  Inbox,
  LayoutDashboard,
  LogOut,
  Mail,
  Menu,
  Settings,
  Shield,
  User,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";

interface NavItem {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  adminOnly?: boolean;
}

const navItems: NavItem[] = [
  { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { title: "Inbox", href: "/inbox", icon: Inbox },
  { title: "Domains", href: "/domains", icon: Globe, adminOnly: true },
  { title: "Forwards", href: "/forwards", icon: Forward },
  { title: "Settings", href: "/settings", icon: Settings },
];

const adminNavItems: NavItem[] = [
  { title: "Admin", href: "/admin", icon: Shield },
  { title: "Users", href: "/admin/users", icon: Users },
  { title: "Inbound", href: "/admin/inbound", icon: Inbox },
  { title: "Logs", href: "/admin/logs", icon: FileText },
  { title: "System", href: "/admin/settings", icon: Cog },
];

const pageTitles: Record<string, { title: string; description?: string }> = {
  "/dashboard": { title: "Dashboard", description: "Overview of your email activity" },
  "/inbox": { title: "Inbox", description: "Mailboxes, grouped — with instant email preview" },
  "/domains": { title: "Domains", description: "Manage your email domains" },
  "/forwards": { title: "Forwards", description: "Configure email forwarding rules" },
  "/settings": { title: "Settings", description: "Manage your account settings" },
  "/emails": { title: "Emails", description: "View all your emails" },
  "/admin": { title: "Admin", description: "System administration" },
};

interface HeaderProps {
  isAdmin?: boolean;
}

export function Header({ isAdmin = false }: HeaderProps) {
  const { data: session } = useSession();
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const userNavItems = navItems.filter((item) => !item.adminOnly || isAdmin);

  // Get page info based on pathname
  const getPageInfo = () => {
    // Check exact match first
    if (pageTitles[pathname]) return pageTitles[pathname];
    // Check prefix match for nested routes
    const basePath = "/" + pathname.split("/")[1];
    return pageTitles[basePath] || null;
  };

  const pageInfo = getPageInfo();

  const initials = session?.user?.name
    ? session.user.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
    : session?.user?.email?.[0].toUpperCase() || "U";

  const renderNavItem = (item: NavItem) => {
    const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
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
        {item.title}
      </Link>
    );
  };

  return (
    <header className="sticky top-0 z-40 bg-white border-b">
      <div className="flex h-14 items-center justify-between px-4 md:px-6">
        <div className="flex items-center gap-3">
          {/* Mobile Menu Button */}
          <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden">
                <Menu className="h-5 w-5" />
                <span className="sr-only">Toggle menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 p-0">
              <SheetHeader className="p-4 border-b">
                <SheetTitle className="flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <Mail className="h-5 w-5 text-primary" />
                  </div>
                  <span className="text-xl font-bold">TEmail</span>
                </SheetTitle>
              </SheetHeader>
              <nav className="p-4 space-y-1">
                {userNavItems.map(renderNavItem)}

                {isAdmin && (
                  <>
                    <div className="pt-4 pb-2">
                      <p className="px-3 text-xs font-semibold text-muted-foreground/60 uppercase tracking-wider">
                        Administration
                      </p>
                    </div>
                    {adminNavItems.map(renderNavItem)}
                  </>
                )}
              </nav>
            </SheetContent>
          </Sheet>

          <div className="md:hidden">
            <span className="text-xl font-bold">TEmail</span>
          </div>
          {pageInfo && (
            <div className="hidden md:block">
              <h1 className="text-lg font-semibold">{pageInfo.title}</h1>
            </div>
          )}
        </div>

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
                <p className="text-sm font-medium">{session?.user?.name || "User"}</p>
                <p className="text-xs text-muted-foreground">{session?.user?.email}</p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/settings" className="cursor-pointer">
                <User className="mr-2 h-4 w-4" />
                Profile
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/settings" className="cursor-pointer">
                <Settings className="mr-2 h-4 w-4" />
                Settings
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="cursor-pointer text-red-600"
              onClick={() => signOut({ callbackUrl: "/login" })}
            >
              <LogOut className="mr-2 h-4 w-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
