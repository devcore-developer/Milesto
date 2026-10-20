export interface Deliverable {
  id: string;
  name: string;
  projectId: string;
  due: string;
  status: "pending" | "in-progress" | "submitted" | "approved";
}

export const deliverables: Deliverable[] = [
  { id: "DLV-01", name: "Beta Release Candidate", projectId: "PRJ-1037", due: "2024-08-12", status: "in-progress" },
  { id: "DLV-02", name: "Migration Runbook", projectId: "PRJ-1051", due: "2024-08-10", status: "pending" },
  { id: "DLV-03", name: "Q3 Financial Integration", projectId: "PRJ-1042", due: "2024-08-18", status: "in-progress" },
  { id: "DLV-04", name: "API Public Docs", projectId: "PRJ-1029", due: "2024-09-05", status: "pending" },
  { id: "DLV-05", name: "Marketing Assets Handoff", projectId: "PRJ-1018", due: "2024-07-22", status: "approved" },
];