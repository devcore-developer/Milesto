import { PageHeader } from "./page-header";
import { EmptyState } from "./empty-state";
import { Construction } from "lucide-react";

interface PlaceholderPageProps {
  title: string;
  description: string;
  badge?: string;
}

export function PlaceholderPage({ title, description, badge }: PlaceholderPageProps) {
  return (
    <div className="space-y-6">
      <PageHeader title={title} description={description} />
      <EmptyState
        icon={Construction}
        title="Coming in a later phase"
        description="This module is part of Milesto’s roadmap. The visual foundations, navigation, and design system are ready — full functionality lands in subsequent phases."
      />
      {badge && (
        <p className="text-center text-2xs text-muted-foreground">{badge}</p>
      )}
    </div>
  );
}