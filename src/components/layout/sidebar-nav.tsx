"use client";

import { NavItem } from "./nav-item";
import { mainNav, secondaryNav } from "@/lib/nav-config";
import { Separator } from "@/components/ui/separator";

export function SidebarNav() {
  return (
    <nav aria-label="Primary" className="flex flex-col gap-6 px-3 py-5">
      <div className="space-y-1">
        <p className="px-3 pb-1 text-2xs font-semibold uppercase tracking-wider text-sidebar-muted">
          Workspace
        </p>
        {mainNav.map((item) => (
          <NavItem key={item.href} {...item} />
        ))}
      </div>

      <Separator className="bg-sidebar-border" />

      <div className="space-y-1">
        <p className="px-3 pb-1 text-2xs font-semibold uppercase tracking-wider text-sidebar-muted">
          System
        </p>
        {secondaryNav.map((item) => (
          <NavItem key={item.href} {...item} />
        ))}
      </div>
    </nav>
  );
}