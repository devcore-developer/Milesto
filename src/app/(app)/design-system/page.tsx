import { PageHeader } from "@/components/common/page-header";
import { SectionHeader } from "@/components/common/section-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { Info } from "lucide-react";
import { ShowcaseMetrics } from "@/components/showcase/showcase-metrics";
import { ShowcaseProgress } from "@/components/showcase/showcase-progress";
import { ShowcaseCharts } from "@/components/showcase/showcase-charts";
import { ShowcaseTable } from "@/components/showcase/showcase-table";
import { ShowcaseBadges } from "@/components/showcase/showcase-badges";
import { ShowcaseStates } from "@/components/showcase/showcase-states";

export const metadata = { title: "Design System" };

const palette = [
  { name: "Primary", className: "bg-primary" },
  { name: "Teal", className: "bg-chart-2" },
  { name: "Green", className: "bg-chart-3" },
  { name: "Amber", className: "bg-chart-4" },
  { name: "Violet", className: "bg-chart-5" },
  { name: "Red", className: "bg-chart-6" },
];

const sidebarPalette = [
  { name: "Sidebar", className: "bg-sidebar" },
  { name: "Sidebar accent", className: "bg-sidebar-accent" },
  { name: "Sidebar primary", className: "bg-sidebar-primary" },
];

export default function DesignSystemPage() {
  return (
    <div className="space-y-10">
      <PageHeader
        title="Design System"
        description="The visual foundation and reusable interface architecture for Milesto. Every component, token, and chart style shown here is what Phase 2+ modules will build on."
      />

      {/* Foundations */}
      <section className="space-y-4">
        <SectionHeader title="Foundations" description="Color palette, typography, and core controls" />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="rounded-lg border border-border bg-card p-5 shadow-xs lg:col-span-2">
            <p className="text-xs font-medium text-muted-foreground">Chart & accent palette</p>
            <div className="mt-3 grid grid-cols-3 gap-3 sm:grid-cols-6">
              {palette.map((c) => (
                <div key={c.name} className="space-y-1.5">
                  <div className={`h-12 rounded-md ${c.className}`} />
                  <p className="text-2xs font-medium text-foreground">{c.name}</p>
                </div>
              ))}
            </div>
            <p className="mt-5 text-xs font-medium text-muted-foreground">Sidebar (deep navy)</p>
            <div className="mt-3 grid grid-cols-3 gap-3">
              {sidebarPalette.map((c) => (
                <div key={c.name} className="space-y-1.5">
                  <div className={`h-12 rounded-md ${c.className}`} />
                  <p className="text-2xs font-medium text-foreground">{c.name}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-border bg-card p-5 shadow-xs">
            <p className="text-xs font-medium text-muted-foreground">Typography</p>
            <div className="mt-3 space-y-2">
              <p className="text-2xl font-semibold tracking-tight text-foreground">Display</p>
              <p className="text-base font-medium text-foreground">Section heading</p>
              <p className="text-sm text-foreground">Body text — comfortable, readable, slightly tinted.</p>
              <p className="text-xs text-muted-foreground">Caption / metadata · 2xs uppercase</p>
            </div>
            <div className="mt-5 space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Controls</p>
              <div className="flex flex-wrap items-center gap-2">
                <Button size="sm">Primary</Button>
                <Button size="sm" variant="outline">Outline</Button>
                <Button size="sm" variant="ghost">Ghost</Button>
                <Button size="sm" variant="subtle">Subtle</Button>
                <Button size="sm" variant="destructive">Destructive</Button>
              </div>
              <Input placeholder="Input field" className="mt-2" />
              <div className="flex items-center gap-2 pt-1">
                <Badge variant="default">Default</Badge>
                <Badge variant="success">Success</Badge>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent/60 hover:text-foreground" aria-label="Info">
                      <Info className="h-4 w-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>Tooltip with helpful context</TooltipContent>
                </Tooltip>
              </div>
            </div>
          </div>
        </div>
      </section>

      <ShowcaseMetrics />
      <ShowcaseProgress />
      <ShowcaseCharts />
      <ShowcaseTable />
      <ShowcaseBadges />
      <ShowcaseStates />
    </div>
  );
}