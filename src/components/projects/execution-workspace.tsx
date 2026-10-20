"use client";

import { useState } from "react";
import { useProjects } from "@/lib/project-context";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronRight, Plus, AlertTriangle } from "lucide-react";
import { calculatePhaseProgress, calculateTaskProgress, isTaskBlocked } from "@/lib/progress-engine";
import { TaskDialog } from "./task-dialog";
import { PhaseDialog } from "./phase-dialog";
import type { Task, Phase } from "@/types";

export function ExecutionWorkspace({ projectId }: { projectId: string }) {
  const { phases, getProjectProgress } = useProjects();
  const projectPhases = phases.filter((p) => p.projectId === projectId);
  
  const [isPhaseDialogOpen, setIsPhaseDialogOpen] = useState(false);
  const [isTaskDialogOpen, setIsTaskDialogOpen] = useState(false);
  const [selectedPhaseId, setSelectedPhaseId] = useState<string | undefined>();

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold">Execution Plan</h3>
          <p className="text-sm text-muted-foreground">Overall Progress: {getProjectProgress(projectId)}%</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => { setSelectedPhaseId(undefined); setIsPhaseDialogOpen(true); }}>
            <Plus className="h-4 w-4 mr-1" /> Phase
          </Button>
          <Button size="sm" onClick={() => { setSelectedPhaseId(projectPhases[0]?.id); setIsTaskDialogOpen(true); }}>
            <Plus className="h-4 w-4 mr-1" /> Task
          </Button>
        </div>
      </div>

      <div className="space-y-4">
        {projectPhases.map(phase => (
          <PhaseCard key={phase.id} phase={phase} projectId={projectId} />
        ))}
      </div>

      <PhaseDialog open={isPhaseDialogOpen} onOpenChange={setIsPhaseDialogOpen} projectId={projectId} />
      <TaskDialog open={isTaskDialogOpen} onOpenChange={setIsTaskDialogOpen} projectId={projectId} phaseId={selectedPhaseId} />
    </div>
  );
}

function PhaseCard({ phase, projectId }: { phase: Phase; projectId: string }) {
  const { tasks } = useProjects();
  const [isExpanded, setIsExpanded] = useState(true);
  const [isTaskDialogOpen, setIsTaskDialogOpen] = useState(false);
  
  const phaseTasks = tasks.filter(t => t.phaseId === phase.id && !t.parentId);
  const progress = calculatePhaseProgress(phase, tasks);

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 flex-1">
          <Button variant="ghost" size="icon-sm" onClick={() => setIsExpanded(!isExpanded)}>
            {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </Button>
          <div>
            <h4 className="font-medium text-sm">{phase.name}</h4>
            <p className="text-xs text-muted-foreground">{phaseTasks.length} Tasks · Weight: {phase.weight}%</p>
          </div>
        </div>
        <div className="flex items-center gap-4 w-1/3">
          <Progress value={progress} className="h-2" />
          <span className="text-sm font-medium w-12 text-right">{progress}%</span>
          <Button variant="ghost" size="icon-sm" onClick={() => setIsTaskDialogOpen(true)}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {isExpanded && (
        <div className="mt-4 pl-8 space-y-2 border-l border-border ml-2">
          {phaseTasks.length === 0 && <p className="text-sm text-muted-foreground py-4">No tasks in this phase yet.</p>}
          {phaseTasks.map(task => (
          <TaskRow key={task.id} task={task} allTasks={tasks} level={0} />
          ))}
        </div>
      )}
      <TaskDialog open={isTaskDialogOpen} onOpenChange={setIsTaskDialogOpen} projectId={projectId} phaseId={phase.id} />
    </Card>
  );
}

function TaskRow({ task, allTasks, level }: { task: Task; allTasks: Task[]; level: number }) {
  const { updateTask } = useProjects();
  const [isExpanded, setIsExpanded] = useState(false);
  const subtasks = allTasks.filter(t => t.parentId === task.id);
  const progress = calculateTaskProgress(task, allTasks);
  const blocked = isTaskBlocked(task, allTasks);

  const toggleStatus = () => {
    updateTask(task.id, { status: task.status === "done" ? "todo" : "done", progress: task.status === "done" ? 0 : 100 });
  };

  return (
    <div>
      <div className={`flex items-center gap-3 py-2 ${level > 0 ? "ml-6 border-l border-border pl-4" : ""}`}>
        {subtasks.length > 0 ? (
          <Button variant="ghost" size="icon-sm" onClick={() => setIsExpanded(!isExpanded)}>
            {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          </Button>
        ) : (
          <div className="w-8"></div>
        )}
        
        <input 
          type="checkbox" 
          checked={task.status === "done"} 
          onChange={toggleStatus}
          className="h-4 w-4 rounded border-border accent-primary"
        />
        
        <div className="flex-1 flex items-center gap-2">
          <span className={`text-sm ${task.status === "done" ? "line-through text-muted-foreground" : "text-foreground"}`}>
            {task.title}
          </span>
          {blocked && <Badge variant="danger" className="text-2xs"><AlertTriangle className="h-3 w-3 mr-1" /> Blocked</Badge>}
        </div>

        <div className="flex items-center gap-4 w-1/4">
          <Progress value={progress} className="h-1.5" />
          <span className="text-xs text-muted-foreground w-10 text-right">{progress}%</span>
        </div>
      </div>

      {isExpanded && subtasks.map(subtask => (
        <TaskRow key={subtask.id} task={subtask} allTasks={allTasks} level={level + 1} />
      ))}
    </div>
  );
}