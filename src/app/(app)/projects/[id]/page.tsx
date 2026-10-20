"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useProjects } from "@/lib/project-context";
import { PageHeader } from "@/components/common/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ProjectStatusBadge, PriorityBadge } from "@/components/metrics/status-badge";
import { ProgressRing } from "@/components/metrics/progress-ring";
import { ProjectFormDialog } from "@/components/projects/project-form-dialog";
import { ExecutionWorkspace } from "@/components/projects/execution-workspace";
import { ProjectTestingPanel } from "@/components/testing/project-testing-panel";
import { KnowledgePanel } from "@/components/notes/knowledge-panel";
import { EmptyState } from "@/components/common/empty-state";
import { formatCurrency, formatDate } from "@/lib/utils";
import { ArrowLeft, Pencil, CalendarDays, FileText } from "lucide-react";

export default function ProjectDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const { getProjectById, getProjectProgress } = useProjects();
  const [isEditOpen, setIsEditOpen] = useState(false);

  const project = getProjectById(params.id as string);

  if (!project) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <EmptyState
          icon={FileText}
          title="Project not found"
          description="The project you are looking for does not exist or has been deleted."
          actionLabel="Back to Projects"
          onAction={() => router.push("/projects")}
        />
      </div>
    );
  }

  const outstanding = project.contractValue - project.paymentsReceived;
  const calculatedProgress = getProjectProgress(project.id);
  const displayProgress = calculatedProgress > 0 ? calculatedProgress : project.progress;

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" onClick={() => router.push("/projects")} className="text-muted-foreground hover:text-foreground">
        <ArrowLeft className="mr-1.5 h-3.5 w-3.5" /> Back to Projects
      </Button>

      <PageHeader
        title={project.name}
        description={project.description}
        actions={<Button variant="outline" onClick={() => setIsEditOpen(true)}><Pencil className="h-4 w-4" /> Edit Project</Button>}
      />

      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline">{project.category}</Badge>
        <ProjectStatusBadge status={project.status} />
        <PriorityBadge priority={project.priority} />
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="tasks">Phases & Tasks</TabsTrigger>
          <TabsTrigger value="testing">Testing</TabsTrigger>
          <TabsTrigger value="notes">Notes</TabsTrigger>
          <TabsTrigger value="deliverables" disabled>Deliverables</TabsTrigger>
          <TabsTrigger value="finance" disabled>Finance</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-6">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="space-y-6 lg:col-span-2">
              <Card>
                <CardHeader><CardTitle>Project Details</CardTitle></CardHeader>
                <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground">Start Date</p>
                    <p className="text-sm text-foreground flex items-center gap-2">
                      <CalendarDays className="h-4 w-4 text-muted-foreground" /> {formatDate(project.startDate)}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground">Deadline</p>
                    <p className="text-sm text-foreground flex items-center gap-2">
                      <CalendarDays className="h-4 w-4 text-muted-foreground" /> {formatDate(project.deadline)}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground">Owner</p>
                    <p className="text-sm text-foreground">{project.owner.name}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground">Last Updated</p>
                    <p className="text-sm text-foreground">{formatDate(project.lastUpdated)}</p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle>Notes</CardTitle></CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground text-pretty">
                    {project.notes || "No notes available for this project."}
                  </p>
                </CardContent>
              </Card>
            </div>

            <div className="space-y-6">
              <Card className="flex flex-col items-center p-6">
                <ProgressRing value={displayProgress} size={120} tone="blue" label="Overall Progress" />
                <p className="mt-4 text-xs text-muted-foreground">Weighted progress based on task completion</p>
              </Card>

              {project.contractValue > 0 && (
                <Card>
                  <CardHeader><CardTitle>Financial Summary</CardTitle></CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Contract Value</span>
                      <span className="font-medium text-green-600">{formatCurrency(project.contractValue)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Payments Received</span>
                      <span className="font-medium text-green-600">{formatCurrency(project.paymentsReceived)}</span>
                    </div>
                    <div className="flex justify-between border-t border-border pt-3 text-sm">
                      <span className="text-muted-foreground">Outstanding Balance</span>
                      <span className="font-semibold text-amber-600">{formatCurrency(outstanding)}</span>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="tasks" className="mt-6">
          <ExecutionWorkspace projectId={project.id} />
        </TabsContent>

        <TabsContent value="testing" className="mt-6">
          <ProjectTestingPanel projectId={project.id} />
        </TabsContent>

        <TabsContent value="notes" className="mt-6">
          <KnowledgePanel projectId={project.id} />
        </TabsContent>
      </Tabs>

      <ProjectFormDialog open={isEditOpen} onOpenChange={setIsEditOpen} project={project} />
    </div>
  );
}