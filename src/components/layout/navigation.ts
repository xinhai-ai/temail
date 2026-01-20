import type React from "react";
import {
  Cog,
  FileText,
  Forward,
  Globe,
  Inbox,
  LayoutDashboard,
  Settings,
  Shield,
  Trash2,
  Users,
  Workflow,
} from "lucide-react";

export interface NavItem {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  adminOnly?: boolean;
}

export const APP_NAV_ITEMS: NavItem[] = [
  { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { title: "Inbox", href: "/inbox", icon: Inbox },
  { title: "Trash", href: "/trash", icon: Trash2 },
  { title: "Domains", href: "/domains", icon: Globe, adminOnly: true },
  { title: "Workflows", href: "/workflows", icon: Workflow },
  { title: "Forwards", href: "/forwards", icon: Forward },
  { title: "Settings", href: "/settings", icon: Settings },
];

export const ADMIN_NAV_ITEMS: NavItem[] = [
  { title: "Admin", href: "/admin", icon: Shield },
  { title: "Users", href: "/admin/users", icon: Users },
  { title: "Inbound", href: "/admin/inbound", icon: Inbox },
  { title: "Logs", href: "/admin/logs", icon: FileText },
  { title: "System", href: "/admin/settings", icon: Cog },
];

export const PAGE_TITLES: Record<string, { title: string; description?: string }> = {
  "/dashboard": { title: "Dashboard", description: "Overview of your email activity" },
  "/inbox": { title: "Inbox", description: "Mailboxes, grouped — with instant email preview" },
  "/trash": { title: "Trash", description: "Deleted emails (recover or purge)" },
  "/domains": { title: "Domains", description: "Manage inbound email domains" },
  "/workflows": { title: "Workflows", description: "Automate your email processing" },
  "/forwards": { title: "Forwards", description: "Configure email forwarding rules" },
  "/settings": { title: "Settings", description: "Manage your account settings" },
  "/admin": { title: "Admin", description: "System administration" },
};

function matchesPathname(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(href + "/");
}

export function getActiveNavHref(pathname: string, items: Pick<NavItem, "href">[]) {
  let bestHref: string | null = null;
  for (const item of items) {
    if (!matchesPathname(pathname, item.href)) continue;
    if (!bestHref || item.href.length > bestHref.length) {
      bestHref = item.href;
    }
  }
  return bestHref;
}
