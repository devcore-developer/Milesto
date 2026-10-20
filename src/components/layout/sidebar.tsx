import Link from "next/link";
import { BrandLogo } from "./brand-logo";
import { SidebarNav } from "./sidebar-nav";
import { Sparkles, LifeBuoy } from "lucide-react";

export function Sidebar() {
  return (
    <aside className="sidebar-scroll flex h-full flex-col overflow-y-auto bg-sidebar text-sidebar-foreground">
      <div className="flex items-center gap-2.5 px-5 py-5">
        <Link href="/overview" className="flex items-center gap-2.5 rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-primary">
          <BrandLogo className="h-8 w-8" />
          <div className="flex flex-col leading-tight">
            <span className="text-[15px] font-semibold tracking-tight text-white">Milesto</span>
            <span className="text-2xs text-sidebar-muted">Project workspace</span>
          </div>
        </Link>
      </div>

      <div className="flex-1">
        <SidebarNav />
      </div>

      <div className="px-3 pb-4">
        <div className="rounded-lg border border-sidebar-border bg-white/[0.02] p-3">
          <div className="flex items-center gap-2 text-sidebar-foreground">
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-sidebar-primary/20 text-sidebar-primary">
              <Sparkles className="h-3.5 w-3.5" />
            </span>
            <div className="flex flex-col leading-tight">
              <span className="text-xs font-medium text-white">Phase 1 · Design system</span>
              <span className="text-2xs text-sidebar-muted">Foundations & shell</span>
            </div>
          </div>
        </div>
        <a
          href="#"
          className="mt-2 flex items-center gap-2 rounded-md px-3 py-2 text-2xs text-sidebar-muted transition-colors hover:bg-white/[0.03] hover:text-sidebar-foreground/80"
        >
          <LifeBuoy className="h-3.5 w-3.5" /> Help & documentation
        </a>
      </div>
    </aside>
  );
}