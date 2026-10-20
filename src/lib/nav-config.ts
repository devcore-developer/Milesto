import {
  LayoutDashboard,
  FolderKanban,
  ListChecks,
  CalendarRange,
  ShieldCheck,
  StickyNote,
  Wallet,
  BarChart3,
  Settings,
  Sparkles,
  type LucideIcon,
} from "lucide-react";

export interface NavItemConfig {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Optional badge text, e.g. counts or "New". */
  badge?: string;
}

export const mainNav: NavItemConfig[] = [
  { href: "/overview", label: "Overview", icon: LayoutDashboard },
  { href: "/projects", label: "Projects", icon: FolderKanban, badge: "6" },
  { href: "/tasks", label: "Tasks", icon: ListChecks, badge: "24" },
  { href: "/timeline", label: "Timeline", icon: CalendarRange },
  { href: "/testing", label: "Testing & Quality", icon: ShieldCheck },
  { href: "/notes", label: "Notes", icon: StickyNote },
  { href: "/finance", label: "Finance", icon: Wallet },
  { href: "/reports", label: "Reports & Analytics", icon: BarChart3 },
];

export const secondaryNav: NavItemConfig[] = [
  { href: "/settings", label: "Settings", icon: Settings },
  { href: "/design-system", label: "Design System", icon: Sparkles, badge: "Phase 1" },
];