import { describe, it, expect } from "vitest";
import { calculateTaskProgress, calculatePhaseProgress, hasCircularDependency } from "./progress-engine";
import type { Task, Phase } from "@/types";

const mockTasks: Task[] = [
  { id: "t1", projectId: "p1", phaseId: "ph1", title: "Task 1", status: "done", priority: "low", weight: 5, progress: 100, due: "2024-08-01" },
  { id: "t2", projectId: "p1", phaseId: "ph1", title: "Task 2", status: "in-progress", priority: "low", weight: 5, progress: 50, due: "2024-08-02" },
  { id: "t3", projectId: "p1", phaseId: "ph1", title: "Parent Task", status: "in-progress", priority: "low", weight: 10, progress: 20, due: "2024-08-03" },
  { id: "t4", projectId: "p1", phaseId: "ph1", parentId: "t3", title: "Subtask 1", status: "done", priority: "low", weight: 5, progress: 100, due: "2024-08-04" },
  { id: "t5", projectId: "p1", phaseId: "ph1", parentId: "t3", title: "Subtask 2", status: "todo", priority: "low", weight: 5, progress: 0, due: "2024-08-05" },
];

describe("Progress Engine", () => {
  it("calculates task progress correctly for standalone tasks", () => {
    expect(calculateTaskProgress(mockTasks[0], mockTasks)).toBe(100);
    expect(calculateTaskProgress(mockTasks[1], mockTasks)).toBe(50);
  });

  it("calculates parent task progress from subtasks without double-counting", () => {
    const parentProgress = calculateTaskProgress(mockTasks[2], mockTasks);
    expect(parentProgress).toBe(50);
  });

  it("calculates phase progress ignoring subtasks direct contribution", () => {
    const mockPhase: Phase = { id: "ph1", projectId: "p1", name: "Phase 1", status: "in-progress", weight: 10 };
    expect(calculatePhaseProgress(mockPhase, mockTasks)).toBe(50);
  });

  it("detects circular dependencies", () => {
    const tasks: Task[] = [
      { id: "A", projectId: "p", phaseId: "ph", title: "A", status: "todo", priority: "low", weight: 1, progress: 0, due: "2024-08-01", dependencies: ["B"] },
      { id: "B", projectId: "p", phaseId: "ph", title: "B", status: "todo", priority: "low", weight: 1, progress: 0, due: "2024-08-01", dependencies: [] },
    ];
    expect(hasCircularDependency("B", "A", tasks)).toBe(true);
  });
});