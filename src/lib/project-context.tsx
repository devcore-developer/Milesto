"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

import { projects as initialProjects } from "@/data/projects";
import { phases as initialPhases, tasks as initialTasks } from "@/data/execution-data";
import {
  initialBugs,
  initialExecutions,
  initialGates,
  initialTestCases,
} from "@/data/testing-data";
import { calculateProjectProgress } from "@/lib/progress-engine";

import type {
  Bug,
  GateStatus,
  Phase,
  Project,
  QualityGate,
  Task,
  TestCase,
  TestExecution,
} from "@/types";

const nextId = (prefix: string, items: { id: string }[]) => {
  const pattern = new RegExp(`^${prefix}-(\\d+)$`);
  const maxNumber = items.reduce((max, item) => {
    const match = pattern.exec(item.id);
    if (!match) return max;
    const parsed = Number.parseInt(match[1] ?? "0", 10);
    return Number.isNaN(parsed) ? max : Math.max(max, parsed);
  }, 0);
  return `${prefix}-${String(maxNumber + 1).padStart(2, "0")}`;
};

export type ProjectSeed = Partial<Project>;
export type PhaseSeed = Partial<Phase> & { projectId: string };
export type TaskSeed = Partial<Task> & { projectId: string };
export type TestCaseSeed = Partial<TestCase> & { title: string };
export type ExecutionSeed = Partial<TestExecution> &
  Pick<TestExecution, "testCaseId" | "status" | "date" | "source"> & {
    durationMs?: number;
  };
export type BugSeed = Partial<Bug> & { title: string };

export interface ProjectContextValue {
  projects: Project[];
  phases: Phase[];
  tasks: Task[];
  testCases: TestCase[];
  executions: TestExecution[];
  bugs: Bug[];
  gates: QualityGate[];

  getProjectById: (projectId: string) => Project | undefined;
  getPhasesByProject: (projectId: string) => Phase[];
  getTasksByPhase: (phaseId: string) => Task[];
  getProjectProgress: (projectId: string) => number;

  createProject: (input: ProjectSeed) => Project;
  updateProject: (projectId: string, updates: Partial<Project>) => void;
  deleteProject: (projectId: string) => void;

  createPhase: (input: PhaseSeed) => Phase;
  updatePhase: (phaseId: string, updates: Partial<Phase>) => void;
  deletePhase: (phaseId: string) => void;

  createTask: (input: TaskSeed) => Task;
  updateTask: (taskId: string, updates: Partial<Task>) => void;
  deleteTask: (taskId: string) => void;

  getAllTestCases: () => TestCase[];
  getTestCases: (projectId?: string) => TestCase[];
  getTestCaseById: (testCaseId: string) => TestCase | undefined;
  createTestCase: (input: TestCaseSeed) => TestCase;
  updateTestCase: (testCaseId: string, updates: Partial<TestCase>) => void;
  archiveTestCase: (testCaseId: string) => void;
  duplicateTestCase: (testCaseId: string) => TestCase | undefined;
  deleteTestCase: (testCaseId: string) => boolean;

  getExecutions: (testCaseId: string) => TestExecution[];
  getAllExecutions: () => TestExecution[];
  createExecution: (input: ExecutionSeed) => TestExecution;

  getBugs: (projectId?: string) => Bug[];
  createBug: (input: BugSeed) => Bug;
  updateBug: (bugId: string, updates: Partial<Bug>) => void;

  getGates: (projectId?: string) => QualityGate[];
  createGate: (projectId: string, phaseId: string) => void;
  updateGateCriteria: (
    gateId: string,
    criteria: {
      requiredExecuted?: number;
      requiredPassed?: number;
      requiredPassRate?: number;
      requireNoCriticalBugs?: boolean;
      requireNoHighBugs?: boolean;
      requireManualApproval?: boolean;
    },
  ) => void;
  setGateStatus: (
    gateId: string,
    status: GateStatus,
    options?: { reason?: string; notes?: string },
  ) => void;
  overrideGate: (gateId: string, reason: string, actor?: string) => void;
}

const ProjectContext = createContext<ProjectContextValue | null>(null);

export function ProjectProvider({ children }: { children: ReactNode }) {
  const [projects, setProjects] = useState<Project[]>(initialProjects);
  const [phases, setPhases] = useState<Phase[]>(initialPhases);
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [testCases, setTestCases] = useState<TestCase[]>(initialTestCases);
  const [executions, setExecutions] = useState<TestExecution[]>(initialExecutions);
  const [bugs, setBugs] = useState<Bug[]>(initialBugs);
  const [gates, setGates] = useState<QualityGate[]>(initialGates);

  // ---------- Projects / Phases / Tasks ----------

  const getProjectById = (projectId: string) =>
    projects.find((project) => project.id === projectId);

  const getPhasesByProject = (projectId: string) =>
    phases.filter((phase) => phase.projectId === projectId);

  const getTasksByPhase = (phaseId: string) =>
    tasks.filter((task) => task.phaseId === phaseId);

  const getProjectProgress = (projectId: string) =>
    calculateProjectProgress(projectId, phases, tasks);

  const createProject = (input: ProjectSeed) => {
    const created = { ...(input as Project), id: nextId("PRJ", projects) } as Project;
    setProjects((prev) => [...prev, created]);
    return created;
  };

  const updateProject = (projectId: string, updates: Partial<Project>) => {
    setProjects((prev) =>
      prev.map((project) => (project.id === projectId ? { ...project, ...updates } : project)),
    );
  };

  const deleteProject = (projectId: string) => {
    const phaseIds = new Set(
      phases.filter((phase) => phase.projectId === projectId).map((phase) => phase.id),
    );
    setProjects((prev) => prev.filter((project) => project.id !== projectId));
    setPhases((prev) => prev.filter((phase) => phase.projectId !== projectId));
    setTasks((prev) =>
      prev.filter((task) => task.projectId !== projectId && !phaseIds.has(task.phaseId)),
    );
    setGates((prev) => prev.filter((gate) => gate.projectId !== projectId));
    setTestCases((prev) =>
      prev.map((item) =>
        item.projectId === projectId
          ? ({ ...item, phaseId: "", taskId: undefined, updatedAt: new Date().toISOString() } as TestCase)
          : item,
      ),
    );
  };

  const createPhase = (input: PhaseSeed) => {
    const created = { ...(input as Phase), id: nextId("PHS", phases) } as Phase;
    setPhases((prev) => [...prev, created]);
    return created;
  };

  const updatePhase = (phaseId: string, updates: Partial<Phase>) => {
    setPhases((prev) =>
      prev.map((phase) => (phase.id === phaseId ? { ...phase, ...updates } : phase)),
    );
  };

  const deletePhase = (phaseId: string) => {
    setPhases((prev) => prev.filter((phase) => phase.id !== phaseId));
    setGates((prev) => prev.filter((gate) => gate.phaseId !== phaseId));
    setTestCases((prev) =>
      prev.map((item) =>
        item.phaseId === phaseId
          ? ({ ...item, phaseId: "", taskId: undefined, updatedAt: new Date().toISOString() } as TestCase)
          : item,
      ),
    );
  };

  const createTask = (input: TaskSeed) => {
    const created = { ...(input as Task), id: nextId("TSK", tasks) } as Task;
    setTasks((prev) => [...prev, created]);
    return created;
  };

  const updateTask = (taskId: string, updates: Partial<Task>) => {
    setTasks((prev) =>
      prev.map((task) => (task.id === taskId ? { ...task, ...updates } : task)),
    );
  };

  const deleteTask = (taskId: string) => {
    setTasks((prev) =>
      prev
        .filter((task) => task.id !== taskId)
        .map(
          (task) =>
            ({
              ...task,
              parentId: task.parentId === taskId ? undefined : task.parentId,
              dependencies: task.dependencies?.filter((dependency) => dependency !== taskId),
            }) as Task,
        ),
    );
    setTestCases((prev) =>
      prev.map((item) =>
        item.taskId === taskId
          ? ({ ...item, taskId: undefined, updatedAt: new Date().toISOString() } as TestCase)
          : item,
      ),
    );
  };

  // ---------- Test cases ----------

  const getAllTestCases = () => testCases;

  const getTestCases = (projectId?: string) =>
    testCases.filter((item) => !item.archived && (!projectId || item.projectId === projectId));

  const getTestCaseById = (testCaseId: string) =>
    testCases.find((item) => item.id === testCaseId);

  const createTestCase = (input: TestCaseSeed) => {
    const now = new Date().toISOString();
    const created = {
      ...(input as TestCase),
      archived: false,
      id: nextId("TC", testCases),
      createdAt: now,
      updatedAt: now,
    } as TestCase;
    setTestCases((prev) => [...prev, created]);
    return created;
  };

  const updateTestCase = (testCaseId: string, updates: Partial<TestCase>) => {
    setTestCases((prev) =>
      prev.map((item) =>
        item.id === testCaseId
          ? ({ ...item, ...updates, updatedAt: new Date().toISOString() } as TestCase)
          : item,
      ),
    );
  };

  const archiveTestCase = (testCaseId: string) => {
    setTestCases((prev) =>
      prev.map((item) =>
        item.id === testCaseId
          ? ({ ...item, archived: true, updatedAt: new Date().toISOString() } as TestCase)
          : item,
      ),
    );
  };

  const duplicateTestCase = (testCaseId: string) => {
    const source = testCases.find((item) => item.id === testCaseId);
    if (!source) return undefined;
    const now = new Date().toISOString();
    const created = {
      ...(source as TestCase),
      id: nextId("TC", testCases),
      title: `${source.title} (Copy)`,
      archived: false,
      createdAt: now,
      updatedAt: now,
    } as TestCase;
    setTestCases((prev) => [...prev, created]);
    return created;
  };

  const deleteTestCase = (testCaseId: string) => {
    const hasHistory = executions.some((execution) => execution.testCaseId === testCaseId);
    if (hasHistory) return false;
    setTestCases((prev) => prev.filter((item) => item.id !== testCaseId));
    return true;
  };

  // ---------- Executions (append-only) ----------

  const getExecutions = (testCaseId: string) =>
    executions
      .filter((execution) => execution.testCaseId === testCaseId)
      .sort((a, b) => b.date.localeCompare(a.date));

  const getAllExecutions = () =>
    [...executions].sort((a, b) => b.date.localeCompare(a.date));

  const createExecution = (input: ExecutionSeed) => {
    const created = {
      ...(input as TestExecution),
      id: nextId("EX", executions),
      createdAt: new Date().toISOString(),
    } as TestExecution;
    setExecutions((prev) => [...prev, created]);
    return created;
  };

  // ---------- Bugs ----------

  const getBugs = (projectId?: string) =>
    projectId ? bugs.filter((bug) => bug.projectId === projectId) : bugs;

  const createBug = (input: BugSeed) => {
    const now = new Date().toISOString();
    const created = {
      ...(input as Bug),
      id: nextId("BUG", bugs),
      createdAt: now,
      updatedAt: now,
    } as Bug;
    setBugs((prev) => [...prev, created]);
    return created;
  };

  const updateBug = (bugId: string, updates: Partial<Bug>) => {
    setBugs((prev) =>
      prev.map((bug) =>
        bug.id === bugId ? ({ ...bug, ...updates, updatedAt: new Date().toISOString() } as Bug) : bug,
      ),
    );
  };

  // ---------- Quality gates ----------

  const getGates = (projectId?: string) =>
    projectId ? gates.filter((gate) => gate.projectId === projectId) : gates;

  const createGate = (projectId: string, phaseId: string) => {
    const exists = gates.some((gate) => gate.phaseId === phaseId);
    if (exists) return;
    const created = {
      id: nextId("QG", gates),
      projectId,
      phaseId,
      requiredExecuted: 1,
      requiredPassed: 1,
      requiredPassRate: 80,
      requireNoCriticalBugs: true,
      requireNoHighBugs: false,
      requireManualApproval: true,
      status: "Pending" as GateStatus,
      updatedAt: new Date().toISOString(),
    } as QualityGate;
    setGates((prev) => [...prev, created]);
  };

  const updateGateCriteria = (
    gateId: string,
    criteria: {
      requiredExecuted?: number;
      requiredPassed?: number;
      requiredPassRate?: number;
      requireNoCriticalBugs?: boolean;
      requireNoHighBugs?: boolean;
      requireManualApproval?: boolean;
    },
  ) => {
    setGates((prev) =>
      prev.map((gate) =>
        gate.id === gateId
          ? ({ ...gate, ...criteria, updatedAt: new Date().toISOString() } as QualityGate)
          : gate,
      ),
    );
  };

  const setGateStatus = (
    gateId: string,
    status: GateStatus,
    options?: { reason?: string; notes?: string },
  ) => {
    const now = new Date().toISOString();
    setGates((prev) =>
      prev.map((gate) => {
        if (gate.id !== gateId) return gate;
        if (status === "Approved") {
          return {
            ...gate,
            status,
            approvedBy: "Mara Vey",
            approvedAt: now,
            rejectedReason: undefined,
            updatedAt: now,
          } as QualityGate;
        }
        if (status === "Rejected") {
          return {
            ...gate,
            status,
            rejectedReason: options?.reason ?? "",
            approvedBy: undefined,
            approvedAt: undefined,
            updatedAt: now,
          } as QualityGate;
        }
        if (status === "Blocked") {
          return {
            ...gate,
            status,
            notes: options?.notes,
            updatedAt: now,
          } as QualityGate;
        }
        return {
          ...gate,
          status,
          approvedBy: undefined,
          approvedAt: undefined,
          rejectedReason: undefined,
          updatedAt: now,
        } as QualityGate;
      }),
    );
  };

  const overrideGate = (gateId: string, reason: string, actor: string = "Mara Vey") => {
    const now = new Date().toISOString();
    setGates((prev) =>
      prev.map((gate) =>
        gate.id === gateId
          ? ({
              ...gate,
              status: "Approved" as GateStatus,
              overrideReason: reason,
              overriddenBy: actor,
              overriddenAt: now,
              updatedAt: now,
            } as QualityGate)
          : gate,
      ),
    );
  };

  const value: ProjectContextValue = {
    projects,
    phases,
    tasks,
    testCases,
    executions,
    bugs,
    gates,
    getProjectById,
    getPhasesByProject,
    getTasksByPhase,
    getProjectProgress,
    createProject,
    updateProject,
    deleteProject,
    createPhase,
    updatePhase,
    deletePhase,
    createTask,
    updateTask,
    deleteTask,
    getAllTestCases,
    getTestCases,
    getTestCaseById,
    createTestCase,
    updateTestCase,
    archiveTestCase,
    duplicateTestCase,
    deleteTestCase,
    getExecutions,
    getAllExecutions,
    createExecution,
    getBugs,
    createBug,
    updateBug,
    getGates,
    createGate,
    updateGateCriteria,
    setGateStatus,
    overrideGate,
  };

  return <ProjectContext.Provider value={value}>{children}</ProjectContext.Provider>;
}

export function useProjects() {
  const context = useContext(ProjectContext);
  if (!context) {
    throw new Error("useProjects must be used within a ProjectProvider");
  }
  return context;
}