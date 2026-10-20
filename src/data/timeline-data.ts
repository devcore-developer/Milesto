import type { Milestone, TimelineDeliverable, TimelineEvent } from "@/lib/timeline";

/* ---------------------------------------------------------------------------
 * Timeline & Deliverables seed (Phase 8/10)
 *
 * Bound to the real demo project ids used across the app (PRJ-1042, PRJ-1037,
 * PRJ-1051, PRJ-1029, PRJ-1056) so every timeline record points at a project
 * that actually exists. Deliberately includes one overdue case (DLV-21) and
 * one dependency chain (MS-22 → MS-21) so overdue detection and dependency
 * validation are visible in the demo data.
 * ------------------------------------------------------------------------- */

const SEED_TS = "2024-08-10T09:00:00.000Z";

export const seedMilestones: Milestone[] = [
  {
    id: "MS-01",
    projectId: "PRJ-1042",
    title: "Design system approved",
    dueDate: "2024-06-20",
    status: "done",
    description: "Wireframes and component inventory signed off.",
    createdAt: SEED_TS,
    updatedAt: SEED_TS,
  },
  {
    id: "MS-02",
    projectId: "PRJ-1042",
    title: "Core build complete",
    dueDate: "2024-08-15",
    status: "in-progress",
    description: "Dashboard views and API integration finished.",
    dependencies: ["MS-01"],
    createdAt: SEED_TS,
    updatedAt: SEED_TS,
  },
  {
    id: "MS-03",
    projectId: "PRJ-1042",
    title: "Go-live",
    dueDate: "2024-09-12",
    status: "planned",
    description: "Production release and handover.",
    dependencies: ["MS-02"],
    createdAt: SEED_TS,
    updatedAt: SEED_TS,
  },
  {
    id: "MS-11",
    projectId: "PRJ-1037",
    title: "Checkout hardening complete",
    dueDate: "2024-08-20",
    status: "in-progress",
    createdAt: SEED_TS,
    updatedAt: SEED_TS,
  },
  {
    id: "MS-12",
    projectId: "PRJ-1037",
    title: "Store release",
    dueDate: "2024-08-30",
    status: "planned",
    dependencies: ["MS-11"],
    createdAt: SEED_TS,
    updatedAt: SEED_TS,
  },
  {
    id: "MS-21",
    projectId: "PRJ-1051",
    title: "Reconciliation sign-off",
    dueDate: "2024-08-16",
    status: "at-risk",
    description: "Legacy ledger mapping still blocked.",
    createdAt: SEED_TS,
    updatedAt: SEED_TS,
  },
  {
    id: "MS-22",
    projectId: "PRJ-1051",
    title: "Cutover complete",
    dueDate: "2024-08-30",
    status: "planned",
    dependencies: ["MS-21"],
    createdAt: SEED_TS,
    updatedAt: SEED_TS,
  },
  {
    id: "MS-31",
    projectId: "PRJ-1029",
    title: "API v2 beta",
    dueDate: "2024-08-25",
    status: "in-progress",
    createdAt: SEED_TS,
    updatedAt: SEED_TS,
  },
];

export const seedDeliverables: TimelineDeliverable[] = [
  {
    id: "DLV-01",
    projectId: "PRJ-1042",
    name: "Design system package",
    dueDate: "2024-06-18",
    status: "approved",
    createdAt: SEED_TS,
    updatedAt: SEED_TS,
  },
  {
    id: "DLV-02",
    projectId: "PRJ-1042",
    name: "Component library v1",
    dueDate: "2024-08-01",
    status: "in-progress",
    description: "Shared primitives extracted from the dashboard work.",
    createdAt: SEED_TS,
    updatedAt: SEED_TS,
  },
  {
    id: "DLV-03",
    projectId: "PRJ-1042",
    name: "Handover documentation",
    status: "pending",
    description: "Delivery date not agreed yet.",
    createdAt: SEED_TS,
    updatedAt: SEED_TS,
  },
  {
    id: "DLV-11",
    projectId: "PRJ-1037",
    name: "Checkout regression report",
    dueDate: "2024-08-18",
    status: "submitted",
    createdAt: SEED_TS,
    updatedAt: SEED_TS,
  },
  {
    id: "DLV-12",
    projectId: "PRJ-1037",
    name: "Release notes",
    dueDate: "2024-08-28",
    status: "pending",
    createdAt: SEED_TS,
    updatedAt: SEED_TS,
  },
  {
    id: "DLV-21",
    projectId: "PRJ-1051",
    name: "Reconciliation dashboard",
    dueDate: "2024-08-10",
    status: "in-progress",
    description: "Blocked by legacy ledger mapping — demo overdue case.",
    createdAt: SEED_TS,
    updatedAt: SEED_TS,
  },
  {
    id: "DLV-31",
    projectId: "PRJ-1029",
    name: "API reference draft",
    dueDate: "2024-08-22",
    status: "pending",
    createdAt: SEED_TS,
    updatedAt: SEED_TS,
  },
];

export const seedCustomEvents: TimelineEvent[] = [
  {
    id: "EVT-01",
    title: "Stakeholder demo",
    date: "2024-08-21",
    kind: "custom",
    status: "planned",
    projectId: "PRJ-1042",
    description: "Monthly walkthrough with the internal stakeholders.",
    createdAt: SEED_TS,
  },
  {
    id: "EVT-02",
    title: "App store submission window opens",
    date: "2024-08-26",
    kind: "custom",
    status: "planned",
    projectId: "PRJ-1037",
    createdAt: SEED_TS,
  },
  {
    id: "EVT-03",
    title: "Retrospective — Ledger Migration",
    date: "2024-08-19",
    kind: "custom",
    status: "planned",
    projectId: "PRJ-1051",
    createdAt: SEED_TS,
  },
];