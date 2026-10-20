"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useProjects } from "@/lib/project-context";
import type { Phase, PhaseStatus } from "@/types";

interface PhaseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  phase?: Phase;
}

export function PhaseDialog({ open, onOpenChange, projectId, phase }: PhaseDialogProps) {
  const { createPhase, updatePhase } = useProjects();
  const [name, setName] = useState("");
  const [weight, setWeight] = useState(10);
  const [status, setStatus] = useState<PhaseStatus>("not-started");

  useEffect(() => {
    if (phase) {
      setName(phase.name);
      setWeight(phase.weight);
      setStatus(phase.status);
    } else {
      setName("");
      setWeight(10);
      setStatus("not-started");
    }
  }, [phase, open]);

  const handleSubmit = () => {
    if (!name) return;
    if (phase) {
      updatePhase(phase.id, { name, weight, status });
    } else {
      createPhase({ projectId, name, weight, status });
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{phase ? "Edit Phase" : "Create Phase"}</DialogTitle>
          <DialogDescription>Add a new phase to structure your project execution.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-1.5">
            <Label htmlFor="name">Phase Name</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Development" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="weight">Weight (%)</Label>
              <Input id="weight" type="number" value={weight} onChange={(e) => setWeight(Number(e.target.value))} />
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select onValueChange={(v) => setStatus(v as PhaseStatus)} defaultValue={status}>
                <SelectTrigger><SelectValue placeholder="Select status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="not-started">Not Started</SelectItem>
                  <SelectItem value="in-progress">In Progress</SelectItem>
                  <SelectItem value="blocked">Blocked</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit}>{phase ? "Save Changes" : "Create Phase"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}