export interface Activity {
  id: string;
  type: "task" | "project" | "deliverable" | "finance";
  message: string;
  time: string;
  user: string;
}

export const activities: Activity[] = [
  { id: "ACT-1", type: "task", message: "completed task ‘Chart legend accessibility audit’", time: "2h ago", user: "Riya Anand" },
  { id: "ACT-2", type: "project", message: "updated progress on ‘Ledger Migration’ to 32%", time: "5h ago", user: "Lena Park" },
  { id: "ACT-3", type: "finance", message: "recorded a payment of $20,000 for ‘Northwind Mobile App’", time: "Yesterday", user: "Mara Vey" },
  { id: "ACT-4", type: "deliverable", message: "submitted ‘Beta Release Candidate’", time: "Yesterday", user: "Idris Khan" },
  { id: "ACT-5", type: "project", message: "changed status of ‘Helix API v2’ to On Hold", time: "2d ago", user: "Sam Okafor" },
];