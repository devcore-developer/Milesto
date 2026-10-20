"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Fragment } from "react";
import { ChevronRight } from "lucide-react";
import { mainNav, secondaryNav } from "@/lib/nav-config";
import { cn } from "@/lib/utils";

const labelMap: Record<string, string> = {
  overview: "Overview",
  projects: "Projects",
  tasks: "Tasks",
  timeline: "Timeline",
  testing: "Testing & Quality",
  notes: "Notes",
  finance: "Finance",
  reports: "Reports & Analytics",
  settings: "Settings",
  "design-system": "Design System",
};

export function Breadcrumbs() {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);

  if (segments.length === 0) {
    return <span className="text-sm font-medium text-foreground">Overview</span>;
  }

  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-sm">
      <Link href="/overview" className="text-muted-foreground transition-colors hover:text-foreground">
        Home
      </Link>
      {segments.map((seg, i) => {
        const isLast = i === segments.length - 1;
        const href = "/" + segments.slice(0, i + 1).join("/");
        const label = labelMap[seg] ?? seg.charAt(0).toUpperCase() + seg.slice(1);
        return (
          <Fragment key={href}>
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/60" />
            {isLast ? (
              <span className="font-medium text-foreground">{label}</span>
            ) : (
              <Link href={href} className="text-muted-foreground transition-colors hover:text-foreground">
                {label}
              </Link>
            )}
          </Fragment>
        );
      })}
    </nav>
  );
}