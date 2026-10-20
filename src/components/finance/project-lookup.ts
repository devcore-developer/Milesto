import type {
  FinanceExpense,
  FinanceObligation,
  FinanceTransaction,
  ProjectFinanceProfile,
} from "@/types/finance";

export interface ProjectRef {
  id: string;
  name: string;
}

export function deriveProjectIds(source: {
  obligations?: readonly FinanceObligation[];
  transactions?: readonly FinanceTransaction[];
  expenses?: readonly FinanceExpense[];
  profiles?: readonly ProjectFinanceProfile[];
}): string[] {
  const ids = new Set<string>();
  for (const o of source.obligations ?? []) ids.add(o.projectId);
  for (const t of source.transactions ?? []) ids.add(t.projectId);
  for (const e of source.expenses ?? []) {
    if (e.projectId) ids.add(e.projectId);
  }
  for (const p of source.profiles ?? []) ids.add(p.projectId);
  return [...ids].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

export function resolveProjectName(
  projects: readonly ProjectRef[],
  projectId: string | null | undefined,
): string | null {
  if (!projectId) return null;
  const found = projects.find((p) => p.id === projectId);
  return found ? found.name : null;
}

export function buildProjectOptions(
  projects: readonly ProjectRef[],
  extraIds: readonly string[],
): ProjectRef[] {
  const map = new Map<string, string>();
  for (const p of projects) map.set(p.id, p.name);
  for (const id of extraIds) {
    if (!map.has(id)) map.set(id, id);
  }
  return [...map.entries()]
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}