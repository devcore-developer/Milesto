import type { Phase, Task } from "@/types";

/**
 * Calculate task progress. 
 * If a task has subtasks, its progress is derived from them.
 * If completed, it's 100%.
 */
export function calculateTaskProgress(task: Task, allTasks: Task[]): number {
  if (task.status === "done") return 100;

  const subtasks = allTasks.filter((t) => t.parentId === task.id);
  if (subtasks.length > 0) {
    const totalWeight = subtasks.reduce((sum, st) => sum + st.weight, 0);
    if (totalWeight === 0) return 0; // Fallback if weights are 0
    
    const weightedSum = subtasks.reduce((sum, st) => {
      return sum + (st.weight * calculateTaskProgress(st, allTasks));
    }, 0);
    
    return Math.round((weightedSum / totalWeight) * 100) / 100;
  }

  return task.progress || 0;
}

/**
 * Calculate phase progress from its direct tasks.
 * Prevents double-counting by only looking at top-level tasks (no parentId).
 */
export function calculatePhaseProgress(phase: Phase, allTasks: Task[]): number {
  const phaseTasks = allTasks.filter((t) => t.phaseId === phase.id && !t.parentId);
  if (phaseTasks.length === 0) return 0;

  const totalWeight = phaseTasks.reduce((sum, t) => sum + t.weight, 0);
  const useEqualWeights = totalWeight === 0; // Fallback to equal weights
  
  const sum = phaseTasks.reduce((acc, t) => {
    const weight = useEqualWeights ? 1 : t.weight;
    return acc + (weight * calculateTaskProgress(t, allTasks));
  }, 0);

  const divisor = useEqualWeights ? phaseTasks.length : totalWeight;
  return Math.round((sum / divisor) * 100) / 100;
}

/**
 * Calculate project progress from weighted phases.
 */
export function calculateProjectProgress(projectId: string, phases: Phase[], tasks: Task[]): number {
  const projectPhases = phases.filter((p) => p.projectId === projectId);
  if (projectPhases.length === 0) return 0;
  
  const totalWeight = projectPhases.reduce((sum, p) => sum + p.weight, 0);
  const useEqualWeights = totalWeight === 0;
  
  const sum = projectPhases.reduce((acc, p) => {
    const weight = useEqualWeights ? 1 : p.weight;
    return acc + (weight * calculatePhaseProgress(p, tasks));
  }, 0);

  const divisor = useEqualWeights ? projectPhases.length : totalWeight;
  return Math.round((sum / divisor) * 100) / 100;
}

/**
 * Dependency Check: Is the task blocked by incomplete dependencies?
 */
export function isTaskBlocked(task: Task, allTasks: Task[]): boolean {
  if (!task.dependencies || task.dependencies.length === 0) return false;
  return task.dependencies.some((depId) => {
    const dep = allTasks.find((t) => t.id === depId);
    return !dep || dep.status !== "done";
  });
}

/**
 * Dependency Check: Prevent circular dependencies.
 */
export function hasCircularDependency(taskId: string, newDependencyId: string, allTasks: Task[]): boolean {
  if (taskId === newDependencyId) return true;
  
  const checkDep = (currentId: string, targetId: string, visited: Set<string>): boolean => {
    if (currentId === targetId) return true;
    if (visited.has(currentId)) return false;
    visited.add(currentId);

    const currentTask = allTasks.find((t) => t.id === currentId);
    if (!currentTask?.dependencies) return false;

    return currentTask.dependencies.some((depId) => checkDep(depId, targetId, visited));
  };

  // Check if newDependencyId depends on taskId (directly or indirectly)
  return checkDep(newDependencyId, taskId, new Set());
}