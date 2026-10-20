"use client";

import { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useProjects } from "@/lib/project-context";
import type { Task, Priority } from "@/types";

interface TaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  phaseId?: string;
  task?: Task;
}

export function TaskDialog({ open, onOpenChange, projectId, phaseId, task }: TaskDialogProps) {
  const { createTask, updateTask, phases } = useProjects();
  const projectPhases = useMemo(
    () => phases.filter((phase) => phase.projectId === projectId),
    [phases, projectId]
  );

  const [title, setTitle] = useState("");
  const [selectedPhase, setSelectedPhase] = useState("");
  const [priority, setPriority] = useState<Priority>("medium");
  const [weight, setWeight] = useState(5);
  const [due, setDue] = useState("");

  useEffect(() => {
    if (task) {
      setTitle(task.title);
      setSelectedPhase(task.phaseId);
      setPriority(task.priority);
      setWeight(task.weight);
      setDue(task.due);
    } else {
      setTitle("");
      setSelectedPhase(phaseId || projectPhases[0]?.id || "");
      setPriority("medium");
      setWeight(5);
      setDue(new Date().toISOString().split("T")[0]);
    }
  }, [task, phaseId, open, projectPhases]);

  const handleSubmit = () => {
    if (!title || !selectedPhase) return;
    if (task) {
      updateTask(task.id, { title, phaseId: selectedPhase, priority, weight, due });
    } else {
      createTask({ projectId, phaseId: selectedPhase, title, priority, weight, due, status: "todo", progress: 0 });
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{task ? "Edit Task" : "Create Task"}</DialogTitle>
          <DialogDescription>Add a task to a specific phase.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-1.5">
            <Label htmlFor="title">Task Title</Label>
            <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Setup Database" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Phase</Label>
              <Select value={selectedPhase || undefined} onValueChange={setSelectedPhase}>
                <SelectTrigger><SelectValue placeholder="Select phase" /></SelectTrigger>
                <SelectContent>
                  {projectPhases.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Priority</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as Priority)}>
                <SelectTrigger><SelectValue placeholder="Select priority" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="weight">Weight</Label>
              <Input id="weight" type="number" value={weight} onChange={(e) => setWeight(Number(e.target.value))} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="due">Due Date</Label>
              <Input id="due" type="date" value={due.split("T")[0]} onChange={(e) => setDue(e.target.value)} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit}>{task ? "Save Changes" : "Create Task"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}