import type { Task } from "@/types";

export const tasks: Task[] = [
  { id: "TSK-4821", title: "Implement milestone weighting engine", projectId: "PRJ-1042", phaseId: "PHS-1042-1", status: "in-progress", priority: "high", weight: 5, due: "2024-08-16", progress: 45, assignee: { name: "Mara Vey", initials: "MV" } },
  { id: "TSK-4822", title: "Mobile push notification pipeline", projectId: "PRJ-1037", phaseId: "PHS-1037-1", status: "in-review", priority: "critical", weight: 8, due: "2024-08-12", progress: 80, assignee: { name: "Idris Khan", initials: "IK" } },
  { id: "TSK-4823", title: "Fix ledger reconciliation edge cases", projectId: "PRJ-1051", phaseId: "PHS-1051-1", status: "blocked", priority: "high", weight: 5, due: "2024-08-10", progress: 30, assignee: { name: "Lena Park", initials: "LP" } },
  { id: "TSK-4824", title: "API rate-limit middleware", projectId: "PRJ-1029", phaseId: "PHS-1029-1", status: "todo", priority: "medium", weight: 3, due: "2024-08-22", progress: 0, assignee: { name: "Sam Okafor", initials: "SO" } },
  { id: "TSK-4825", title: "Chart legend accessibility audit", projectId: "PRJ-1056", phaseId: "PHS-1056-1", status: "done", priority: "low", weight: 2, due: "2024-08-05", progress: 100, assignee: { name: "Riya Anand", initials: "RA" } },
  { id: "TSK-4826", title: "Design system documentation", projectId: "PRJ-1042", phaseId: "PHS-1042-2", status: "done", priority: "medium", weight: 3, due: "2024-08-02", progress: 100, assignee: { name: "Mara Vey", initials: "MV" } },
  { id: "TSK-4827", title: "CI/CD pipeline setup for v2", projectId: "PRJ-1029", phaseId: "PHS-1029-2", status: "done", priority: "high", weight: 5, due: "2024-07-28", progress: 100, assignee: { name: "Sam Okafor", initials: "SO" } },
  { id: "TSK-4828", title: "Northwind QA regression suite", projectId: "PRJ-1037", phaseId: "PHS-1037-2", status: "todo", priority: "high", weight: 6, due: "2024-08-20", progress: 0, assignee: { name: "Idris Khan", initials: "IK" } },
  { id: "TSK-4829", title: "Database migration scripts", projectId: "PRJ-1051", phaseId: "PHS-1051-2", status: "in-progress", priority: "critical", weight: 8, due: "2024-08-14", progress: 60, assignee: { name: "Lena Park", initials: "LP" } },
  { id: "TSK-4830", title: "Stakeholder demo prep", projectId: "PRJ-1042", phaseId: "PHS-1042-1", status: "todo", priority: "low", weight: 1, due: "2024-08-25", progress: 0, assignee: { name: "Mara Vey", initials: "MV" } },
];