export interface Notification {
  id: string;
  title: string;
  description: string;
  tone: "info" | "warning" | "success" | "danger";
  time: string;
}

export const notifications: Notification[] = [
  {
    id: "N-01",
    title: "Ledger Migration at risk",
    description: "Progress dropped below threshold. 3 tasks blocked.",
    tone: "danger",
    time: "12m ago",
  },
  {
    id: "N-02",
    title: "Northwind Mobile App — 84% complete",
    description: "Ahead of schedule by 4 days.",
    tone: "success",
    time: "1h ago",
  },
  {
    id: "N-03",
    title: "Weekly report ready",
    description: "Aug W2 throughput report is available.",
    tone: "info",
    time: "3h ago",
  },
  {
    id: "N-04",
    title: "Budget threshold approaching",
    description: "Atlas Platform Redesign used 65% of budget.",
    tone: "warning",
    time: "Yesterday",
  },
];