import type { Phase, Task } from "@/types";

export const phases: Phase[] = [
  { id: "PHS-01", projectId: "PRJ-1042", name: "Discovery & Design", status: "completed", weight: 30, startDate: "2024-06-01", endDate: "2024-06-20" },
  { id: "PHS-02", projectId: "PRJ-1042", name: "Core Development", status: "in-progress", weight: 50, startDate: "2024-06-21", endDate: "2024-08-15" },
  { id: "PHS-03", projectId: "PRJ-1042", name: "QA & Launch", status: "not-started", weight: 20, startDate: "2024-08-16", endDate: "2024-09-12" },
];

export const tasks: Task[] = [
  { id: "TSK-01", projectId: "PRJ-1042", phaseId: "PHS-01", title: "User Interviews", status: "done", priority: "high", weight: 5, progress: 100, due: "2024-06-05" },
  { id: "TSK-02", projectId: "PRJ-1042", phaseId: "PHS-01", title: "Wireframes", status: "done", priority: "medium", weight: 5, progress: 100, due: "2024-06-10" },
  
  { id: "TSK-03", projectId: "PRJ-1042", phaseId: "PHS-02", title: "Database Schema", status: "done", priority: "critical", weight: 10, progress: 100, due: "2024-06-25", dependencies: ["TSK-02"] },
  { id: "TSK-04", projectId: "PRJ-1042", phaseId: "PHS-02", title: "API Endpoints", status: "in-progress", priority: "high", weight: 20, progress: 60, due: "2024-07-15", dependencies: ["TSK-03"] },
  { id: "TSK-05", projectId: "PRJ-1042", phaseId: "PHS-02", title: "Frontend Components", status: "in-progress", priority: "high", weight: 20, progress: 40, due: "2024-08-01" },
  
  { id: "TSK-05A", projectId: "PRJ-1042", phaseId: "PHS-02", parentId: "TSK-05", title: "Setup UI Library", status: "done", priority: "high", weight: 5, progress: 100, due: "2024-07-10" },
  { id: "TSK-05B", projectId: "PRJ-1042", phaseId: "PHS-02", parentId: "TSK-05", title: "Build Dashboard Views", status: "in-progress", priority: "medium", weight: 15, progress: 20, due: "2024-07-30" },
];