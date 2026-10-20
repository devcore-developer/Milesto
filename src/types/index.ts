export type ProjectStatus = "planning" | "in-progress" | "on-hold" | "completed" | "at-risk";
export type TaskStatus = "todo" | "in-progress" | "in-review" | "blocked" | "done";
export type Priority = "low" | "medium" | "high" | "critical";
export type DeadlineTone = "overdue" | "due-soon" | "upcoming" | "completed";
export type PhaseStatus = "not-started" | "in-progress" | "blocked" | "completed";

export interface Project {
  id: string;
  name: string;
  description?: string;
  client: string;
  category: string;
  status: ProjectStatus;
  progress: number;
  startDate: string;
  deadline: string;
  lastUpdated: string;
  owner: { name: string; initials: string };
  priority: Priority;
  weight: number;
  budget: number;
  spent: number;
  contractValue: number;
  paymentsReceived: number;
  notes?: string;
  color?: string;
  history?: { date: string; progress: number }[];
}

export interface Phase {
  id: string;
  projectId: string;
  name: string;
  description?: string;
  status: PhaseStatus;
  weight: number;
  startDate?: string;
  endDate?: string;
  isMilestone?: boolean;
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  projectId: string;
  phaseId: string;
  parentId?: string;
  status: TaskStatus;
  priority: Priority;
  weight: number;
  progress: number;
  startDate?: string;
  due: string;
  assignee?: { name: string; initials: string };
  dependencies?: string[];
}

export interface Deliverable {
  id: string;
  name: string;
  projectId: string;
  due: string;
  status: "pending" | "in-progress" | "submitted" | "approved";
}

export interface Metric {
  label: string;
  value: string;
  delta?: {
    value: string;
    direction: "up" | "down" | "flat";
    tone: "positive" | "negative" | "neutral";
  };
  hint?: string;
  accent: "blue" | "teal" | "green" | "amber" | "violet";
}

export interface ChartDatum {
  [key: string]: string | number;
}

// ─────────────────────────────────────────────
// Testing & Quality Management (Phase 5)
// ─────────────────────────────────────────────

export type TestType = "Manual" | "Automated" | "Integration" | "API" | "UI";
export type TestPriority = "Low" | "Medium" | "High" | "Critical";
export type ExecutionStatus = "Pass" | "Fail" | "Blocked" | "Skipped" | "Not Run";
export type TestRiskLevel = "Low" | "Medium" | "High";
export type ExecutionSource = "manual" | "automated" | "demo";

export interface TestCase {
  id: string;
  projectId: string;
  phaseId?: string;
  taskId?: string;
  title: string;
  description?: string;
  type: TestType;
  priority: TestPriority;
  riskLevel: TestRiskLevel;
  preconditions?: string;
  steps: string[];
  expected: string;
  tags?: string[];
  externalRefs?: string[];
  archived: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TestExecution {
  id: string;
  testCaseId: string;
  status: ExecutionStatus;
  date: string;
  environment?: string;
  buildId?: string;
  actual?: string;
  notes?: string;
  bugId?: string;
  source: ExecutionSource;
  attachments?: string[];
  createdAt: string;
}

export type BugSeverity = "Critical" | "High" | "Medium" | "Low";
export type BugStatus = "Open" | "In Progress" | "Fixed" | "Retest" | "Closed" | "Deferred";

export interface Bug {
  id: string;
  projectId: string;
  phaseId?: string;
  taskId?: string;
  testCaseId?: string;
  title: string;
  description?: string;
  severity: BugSeverity;
  status: BugStatus;
  steps?: string;
  expected?: string;
  actual?: string;
  resolutionNotes?: string;
  createdAt: string;
  updatedAt: string;
}

export type GateStatus = "Pending" | "Ready for Review" | "Approved" | "Rejected" | "Blocked";

export interface QualityGate {
  id: string;
  phaseId: string;
  projectId: string;
  requiredExecuted: number;
  requiredPassed: number;
  requiredPassRate: number;
  requireNoCriticalBugs: boolean;
  requireNoHighBugs: boolean;
  requireManualApproval: boolean;
  status: GateStatus;
  notes?: string;
  approvedBy?: string;
  approvedAt?: string;
  rejectedReason?: string;
  overrideReason?: string;
  overriddenBy?: string;
  overriddenAt?: string;
  updatedAt: string;
}

// ─────────────────────────────────────────────
// Notes & Knowledge Center (Phase 6)
// ─────────────────────────────────────────────

export type NoteType =
  | "General"
  | "Technical"
  | "Meeting"
  | "Decision"
  | "Bug Investigation"
  | "Research"
  | "Retrospective";

export type DecisionStatus = "Proposed" | "Accepted" | "Rejected" | "Superseded";

export interface NoteLink {
  projectId?: string;
  phaseId?: string;
  taskId?: string;
  testCaseId?: string;
}

export interface NoteAttachment {
  id: string;
  name: string;
  url: string;
}

export interface KnowledgeNote {
  id: string;
  title: string;
  content: string;
  type: NoteType;
  tags: string[];
  links: NoteLink;
  pinned: boolean;
  favorite: boolean;
  archived: boolean;
  isDraft: boolean;
  attachments: NoteAttachment[];
  createdAt: string;
  updatedAt: string;
  lastViewedAt?: string;
  author?: { name: string; initials: string };
}

export interface DecisionOption {
  title: string;
  description?: string;
}

export interface DecisionRecord {
  id: string;
  title: string;
  description: string;
  context: string;
  options: DecisionOption[];
  selectedOption?: string;
  rationale?: string;
  consequences?: string;
  links: NoteLink;
  status: DecisionStatus;
  decidedAt: string;
  author?: { name: string; initials: string };
  supersededById?: string;
  createdAt: string;
  updatedAt: string;
}

export interface NoteTemplate {
  id: string;
  name: string;
  noteType: NoteType;
  description?: string;
  titlePrefix?: string;
  contentTemplate: string;
  isBuiltin: boolean;
}