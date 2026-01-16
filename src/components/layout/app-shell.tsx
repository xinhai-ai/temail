"use client";

import { useState } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { cn } from "@/lib/utils";

const SIDEBAR_COLLAPSED_COOKIE = "temail_sidebar_collapsed";
const SIDEBAR_COLLAPSED_STORAGE_KEY = "temail.sidebarCollapsed";

export function AppShell({
  children,
  isAdmin,
  initialSidebarCollapsed = false,
}: {
  children: React.ReactNode;
  isAdmin: boolean;
  initialSidebarCollapsed?: boolean;
}) {
  const [collapsed, setCollapsed] = useState(initialSidebarCollapsed);

  const handleCollapsedChange = (next: boolean) => {
    setCollapsed(next);
    try {
      localStorage.setItem(SIDEBAR_COLLAPSED_STORAGE_KEY, next ? "1" : "0");
    } catch {
      // ignore
    }
    try {
      document.cookie = `${SIDEBAR_COLLAPSED_COOKIE}=${next ? "1" : "0"}; Path=/; Max-Age=31536000; SameSite=Lax`;
    } catch {
      // ignore
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <Sidebar isAdmin={isAdmin} collapsed={collapsed} onCollapsedChange={handleCollapsedChange} />
      <div className={cn(collapsed ? "md:pl-16" : "md:pl-64")}>
        <Header />
        <main className="p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
