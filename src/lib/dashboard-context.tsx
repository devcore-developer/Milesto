// src/lib/dashboard-context.tsx
"use client";

import React, { createContext, useContext, useState, useMemo } from "react";

export interface DashboardFilters {
  timeRange: "30d" | "90d" | "ytd";
  category: "all" | string; // تم التعديل هنا
  status: "all" | string;   // تم التعديل هنا
  projectId: "all" | string;
}

const defaultFilters: DashboardFilters = {
  timeRange: "90d",
  category: "all",
  status: "all",
  projectId: "all",
};

interface DashboardContextType {
  filters: DashboardFilters;
  setFilters: React.Dispatch<React.SetStateAction<DashboardFilters>>;
  resetFilters: () => void;
}

const DashboardContext = createContext<DashboardContextType | undefined>(undefined);

export function DashboardProvider({ children }: { children: React.ReactNode }) {
  const [filters, setFilters] = useState<DashboardFilters>(defaultFilters);

  const resetFilters = () => setFilters(defaultFilters);

  const value = useMemo(() => ({ filters, setFilters, resetFilters }), [filters]);

  return <DashboardContext.Provider value={value}>{children}</DashboardContext.Provider>;
}

export function useDashboard() {
  const ctx = useContext(DashboardContext);
  if (!ctx) throw new Error("useDashboard must be used within DashboardProvider");
  return ctx;
}