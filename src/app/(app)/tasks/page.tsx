// src/app/(app)/tasks/page.tsx
import { PlaceholderPage } from "@/components/common/placeholder-page";
export const metadata = { title: "Tasks" };
export default function TasksPage() {
  return <PlaceholderPage title="Tasks" description="Weighted tasks across all projects with priority, status, and deadlines." badge="Planned for Phase 2" />;
}