import type React from "react";
import {
  Cog,
  FileText,
  Globe,
  Inbox,
  LayoutDashboard,
  MessageCircle,
  Settings,
  Shield,
  Trash2,
  Users,
  Workflow,
} from "lucide-react";

export interface NavItem {
  titleKey: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  adminOnly?: boolean;
}

export const APP_NAV_ITEMS: NavItem[] = [
  { titleKey: "nav.dashboard", href: "/dashboard", icon: LayoutDashboard },
  { titleKey: "nav.inbox", href: "/inbox", icon: Inbox },
  { titleKey: "nav.trash", href: "/trash", icon: Trash2 },
  { titleKey: "nav.domains", href: "/domains", icon: Globe, adminOnly: true },
  { titleKey: "nav.workflows", href: "/workflows", icon: Workflow },
  { titleKey: "nav.telegram", href: "/telegram", icon: MessageCircle },
  { titleKey: "nav.settings", href: "/settings", icon: Settings },
];

export const ADMIN_NAV_ITEMS: NavItem[] = [
  { titleKey: "nav.admin", href: "/admin", icon: Shield },
  { titleKey: "nav.users", href: "/admin/users", icon: Users },
  { titleKey: "nav.inbound", href: "/admin/inbound", icon: Inbox },
  { titleKey: "nav.logs", href: "/admin/logs", icon: FileText },
  { titleKey: "nav.telegram", href: "/admin/telegram", icon: MessageCircle },
  { titleKey: "nav.system", href: "/admin/settings", icon: Cog },
];

export const PAGE_TITLES: Record<string, { titleKey: string; descriptionKey?: string }> = {
  "/dashboard": { titleKey: "nav.dashboard", descriptionKey: "pages.dashboard.description" },
  "/inbox": { titleKey: "nav.inbox", descriptionKey: "pages.inbox.description" },
  "/trash": { titleKey: "nav.trash", descriptionKey: "pages.trash.description" },
  "/domains": { titleKey: "nav.domains", descriptionKey: "pages.domains.description" },
  "/workflows": { titleKey: "nav.workflows", descriptionKey: "pages.workflows.description" },
  "/telegram": { titleKey: "nav.telegram", descriptionKey: "pages.telegram.description" },
  "/settings": { titleKey: "nav.settings", descriptionKey: "pages.settings.description" },
  "/admin": { titleKey: "nav.admin", descriptionKey: "pages.admin.description" },
  "/admin/telegram": { titleKey: "nav.telegram", descriptionKey: "pages.adminTelegram.description" },
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
