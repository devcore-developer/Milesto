export const PROJECT_CATEGORIES = [
  "SaaS",
  "E-commerce",
  "Corporate Website",
  "Education / EdTech",
  "Healthcare",
  "Internal Tools",
  "Other",
] as const;

export type ProjectCategory = typeof PROJECT_CATEGORIES[number];