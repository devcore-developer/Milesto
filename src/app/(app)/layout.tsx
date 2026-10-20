import { AppShell } from "@/components/layout/app-shell";
import { ProjectProvider } from "@/lib/project-context";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <ProjectProvider>
      <AppShell>{children}</AppShell>
    </ProjectProvider>
  );
}