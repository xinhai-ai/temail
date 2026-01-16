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
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { LogOut, User, Settings } from "lucide-react";
import Link from "next/link";

const pageTitles: Record<string, { title: string; description?: string }> = {
  "/dashboard": { title: "Dashboard", description: "Overview of your email activity" },
  "/inbox": { title: "Inbox", description: "Mailboxes, grouped — with instant email preview" },
  "/domains": { title: "Domains", description: "Manage your email domains" },
  "/forwards": { title: "Forwards", description: "Configure email forwarding rules" },
  "/settings": { title: "Settings", description: "Manage your account settings" },
  "/emails": { title: "Emails", description: "View all your emails" },
  "/admin": { title: "Admin", description: "System administration" },
};

export function Header() {
  const { data: session } = useSession();
  const pathname = usePathname();

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

  return (
    <header className="sticky top-0 z-40 bg-white border-b">
      <div className="flex h-14 items-center justify-between px-4 md:px-6">
        <div className="flex items-center gap-4">
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
                <AvatarFallback className="bg-purple-600 text-white">
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
