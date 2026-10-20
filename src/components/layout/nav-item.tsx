"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

interface NavItemProps {
  href: string;
  label: string;
  icon: LucideIcon;
  badge?: string;
}

export function NavItem({ href, label, icon: Icon, badge }: NavItemProps) {
  const pathname = usePathname();
  const isActive = pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Link
      href={href}
      aria-current={isActive ? "page" : undefined}
      className={cn(
        "nav-link group",
        isActive
          ? "bg-white/[0.06] text-white shadow-sidebar-active"
          : "text-sidebar-foreground/70 hover:bg-white/[0.035] hover:text-white"
      )}
    >
      {isActive && (
        <span
          aria-hidden="true"
          className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-sidebar-primary"
        />
      )}
      <Icon
        className={cn(
          "h-[18px] w-[18px] shrink-0 transition-colors",
          isActive ? "text-sidebar-primary" : "text-sidebar-muted group-hover:text-sidebar-foreground/90"
        )}
        strokeWidth={2}
      />
      <span className="flex-1 truncate">{label}</span>
      {badge && (
        <span
          className={cn(
            "ml-auto rounded-full px-1.5 py-0.5 text-2xs font-medium",
            isActive
              ? "bg-white/10 text-white"
              : "bg-white/[0.06] text-sidebar-muted group-hover:bg-white/10 group-hover:text-sidebar-foreground/80"
          )}
        >
          {badge}
        </span>
      )}
    </Link>
  );
}