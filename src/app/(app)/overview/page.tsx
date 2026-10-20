import { DashboardProvider } from "@/lib/dashboard-context";
import { PageHeader } from "@/components/common/page-header";
import { DashboardFilters } from "@/components/dashboard/dashboard-filters";
import { KpiGrid } from "@/components/dashboard/kpi-grid";
import { MainAnalytics } from "@/components/dashboard/main-analytics";
import { UpcomingDeliverables } from "@/components/dashboard/upcoming-deliverables";
import { MyDayActivity } from "@/components/dashboard/my-day-activity";

export const metadata = { title: "Overview" };

export default function OverviewPage() {
  return (
    <DashboardProvider>
      <div className="space-y-6">
        <PageHeader title="Dashboard" description="Portfolio overview, project health, and upcoming work." />
        
        <DashboardFilters />
        
        <KpiGrid />
        
        <MainAnalytics />
        
        <UpcomingDeliverables />
        
        <MyDayActivity />
      </div>
    </DashboardProvider>
  );
}