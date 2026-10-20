// src/lib/project-schema.ts
import { z } from "zod";

export const projectSchema = z.object({
  name: z.string().min(3, "Project name must be at least 3 characters"),
  description: z.string().optional(),
  category: z.string().min(1, "Category is required"),
  status: z.enum(["planning", "in-progress", "on-hold", "at-risk", "completed"]),
  priority: z.enum(["low", "medium", "high", "critical"]),
  startDate: z.string().min(1, "Start date is required"),
  deadline: z.string().min(1, "Deadline is required"),
  contractValue: z.coerce.number().min(0, "Value must be non-negative"),
  notes: z.string().optional(),
  color: z.string().optional(),
}).refine((data) => new Date(data.deadline) >= new Date(data.startDate), {
  message: "Deadline must be after start date",
  path: ["deadline"],
});

export type ProjectFormValues = z.infer<typeof projectSchema>;