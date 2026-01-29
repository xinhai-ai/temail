"use client";

import * as React from "react";
import { useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Check, Loader2 } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type SettingsNavItem = {
  id: string;
  label: string;
  icon: LucideIcon;
};

type SettingsLayoutProps = {
  title: string;
  subtitle?: string;
  navItems: SettingsNavItem[];
  activeSection: string;
  onSectionChange: (section: string) => void;
  saving?: boolean;
  saved?: boolean;
  children: React.ReactNode;
};

export function SettingsLayout({
  title,
  subtitle,
  navItems,
  activeSection,
  onSectionChange,
  saving,
  saved,
  children,
}: SettingsLayoutProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const activeButtonRef = useRef<HTMLButtonElement>(null);

  // Scroll active item into view on mobile
  useEffect(() => {
    if (activeButtonRef.current && scrollContainerRef.current) {
      const container = scrollContainerRef.current;
      const button = activeButtonRef.current;
      const containerRect = container.getBoundingClientRect();
      const buttonRect = button.getBoundingClientRect();

      // Check if button is not fully visible
      if (buttonRect.left < containerRect.left || buttonRect.right > containerRect.right) {
        button.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
      }
    }
  }, [activeSection]);

  // Desktop sidebar navigation
  const sidebarNav = (
    <nav className="flex flex-col gap-1 py-2">
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = activeSection === item.id;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onSectionChange(item.id)}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              isActive
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:bg-accent hover:text-foreground"
            )}
          >
            <Icon className="h-4 w-4" />
            {item.label}
          </button>
        );
      })}
    </nav>
  );

  // Mobile horizontal scrolling navigation
  const mobileNav = (
    <div
      ref={scrollContainerRef}
      className="md:hidden -mx-4 px-4 overflow-x-auto scrollbar-none"
    >
      <nav className="flex gap-1 pb-2 min-w-max">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeSection === item.id;
          return (
            <button
              key={item.id}
              ref={isActive ? activeButtonRef : null}
              type="button"
              onClick={() => onSectionChange(item.id)}
              className={cn(
                "flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-muted text-muted-foreground hover:bg-accent hover:text-foreground"
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </button>
          );
        })}
      </nav>
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">{title}</h1>
          {subtitle && <p className="text-muted-foreground">{subtitle}</p>}
        </div>
        {/* Save status indicator */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          {saving && (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Saving...</span>
            </>
          )}
          {saved && !saving && (
            <>
              <Check className="h-4 w-4 text-green-500" />
              <span className="text-green-600">Saved</span>
            </>
          )}
        </div>
      </div>

      {/* Mobile horizontal navigation */}
      {mobileNav}

      {/* Desktop layout with sidebar */}
      <div className="flex gap-6">
        {/* Sidebar - hidden on mobile */}
        <aside className="hidden md:block w-56 shrink-0">
          <div className="sticky top-6">{sidebarNav}</div>
        </aside>

        {/* Content area */}
        <main className="flex-1 min-w-0">{children}</main>
      </div>
    </div>
  );
}
