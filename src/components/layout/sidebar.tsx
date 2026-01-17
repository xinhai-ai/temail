"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Mail,
  Inbox,
  Globe,
  Forward,
  Settings,
  Shield,
  Users,
  FileText,
  Cog,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";

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

interface SidebarProps {
  isAdmin?: boolean;
  collapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
}

export function Sidebar({ isAdmin = false, collapsed: collapsedProp, onCollapsedChange }: SidebarProps) {
  const pathname = usePathname();
  const [uncontrolledCollapsed, setUncontrolledCollapsed] = useState(false);
  const collapsed = collapsedProp ?? uncontrolledCollapsed;

  const userNavItems = navItems.filter((item) => !item.adminOnly || isAdmin);

  const setCollapsed = (next: boolean) => {
    if (collapsedProp === undefined) {
      setUncontrolledCollapsed(next);
    }
    onCollapsedChange?.(next);
  };

  const renderNavItem = (item: NavItem) => {
    const isActive = pathname === item.href;

    const link = (
      <Link
        href={item.href}
        className={cn(
          "group flex items-center px-3 py-2.5 text-sm font-medium rounded-lg transition-all",
          collapsed && "justify-center px-2",
          isActive
            ? "bg-primary text-primary-foreground shadow-sm"
            : "text-muted-foreground hover:bg-accent hover:text-foreground"
        )}
        aria-label={collapsed ? item.title : undefined}
      >
        <item.icon
          className={cn(
            "h-5 w-5 transition-colors",
            !collapsed && "mr-3",
            isActive ? "text-primary-foreground" : "text-muted-foreground group-hover:text-foreground"
          )}
        />
        {!collapsed && item.title}
      </Link>
    );

    if (!collapsed) {
      return (
        <div key={item.href}>
          {link}
        </div>
      );
    }

    return (
      <Tooltip key={item.href}>
        <TooltipTrigger asChild>{link}</TooltipTrigger>
        <TooltipContent side="right">{item.title}</TooltipContent>
      </Tooltip>
    );
  };

  return (
    <aside
      className={cn(
        "hidden md:flex md:flex-col md:fixed md:inset-y-0 transition-[width] duration-200 ease-in-out",
        collapsed ? "md:w-16" : "md:w-64"
      )}
    >
      <div className="flex flex-col flex-grow pt-5 bg-sidebar border-r border-sidebar-border overflow-y-auto">
        <div className={cn("flex items-center flex-shrink-0", collapsed ? "justify-center px-2" : "px-4")}>
          <Link href="/dashboard" className={cn("flex items-center", collapsed ? "space-x-0" : "space-x-2")}>
            <div className="p-2 rounded-lg bg-primary/10">
              <Mail className="h-6 w-6 text-primary" />
            </div>
            {!collapsed && <span className="text-xl font-bold text-foreground">TEmail</span>}
          </Link>
        </div>
        <TooltipProvider delayDuration={200}>
          <nav className={cn("mt-8 flex-1 space-y-1", collapsed ? "px-1" : "px-2")}>
            {userNavItems.map(renderNavItem)}

            {isAdmin && (
              <>
                <div className={cn("pt-6 pb-2", collapsed && "px-2")}>
                  {!collapsed ? (
                    <p className="px-3 text-xs font-semibold text-muted-foreground/60 uppercase tracking-wider">
                      Administration
                    </p>
                  ) : (
                    <div className="h-px bg-sidebar-border/70" />
                  )}
                </div>
                {adminNavItems.map(renderNavItem)}
              </>
            )}
          </nav>

          <div className={cn("mt-auto p-2 border-t border-sidebar-border", collapsed ? "flex justify-center" : "flex justify-end")}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
                  onClick={() => setCollapsed(!collapsed)}
                >
                  {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">
                {collapsed ? "Expand sidebar" : "Collapse sidebar"}
              </TooltipContent>
            </Tooltip>
          </div>
        </TooltipProvider>
      </div>
    </aside>
  );
}
