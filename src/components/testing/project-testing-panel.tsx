"use client";

import { useState } from "react";
import { useProjects } from "@/lib/project-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { getLatestExecution, evaluateGate } from "@/lib/quality-engine";
import type { ExecutionStatus, QualityGate } from "@/types";

export function ProjectTestingPanel({ projectId }: { projectId: string }) {
  const {
    getTestCases,
    getExecutions,
    getAllExecutions,
    createExecution,
    getPhasesByProject,
    getGates,
    createGate,
    setGateStatus,
    overrideGate,
    getBugs,
  } = useProjects();

  const testCases = getTestCases(projectId);
  const phases = getPhasesByProject(projectId);
  const gates = getGates(projectId);
  const allExecutions = getAllExecutions();
  const bugs = getBugs();
  const phasesWithoutGate = phases.filter((phase) => !gates.some((gate) => gate.phaseId === phase.id));

  const [isExecDialogOpen, setIsExecDialogOpen] = useState(false);
  const [selectedTestCase, setSelectedTestCase] = useState<string | undefined>();
  const [execStatus, setExecStatus] = useState<ExecutionStatus>("Pass");
  const [execNotes, setExecNotes] = useState("");

  const [overrideTarget, setOverrideTarget] = useState<QualityGate | undefined>();
  const [overrideReason, setOverrideReason] = useState("");

  const selectedCase = testCases.find((tc) => tc.id === selectedTestCase);

  const handleOpenExecDialog = (testCaseId: string) => {
    setSelectedTestCase(testCaseId);
    setExecStatus("Pass");
    setExecNotes("");
    setIsExecDialogOpen(true);
  };

  const handleSaveExecution = () => {
    if (!selectedTestCase) return;
    createExecution({
      testCaseId: selectedTestCase,
      status: execStatus,
      source: "manual",
      date: new Date().toISOString().split("T")[0],
      notes: execNotes || undefined,
    });
    setIsExecDialogOpen(false);
  };

  const closeOverrideDialog = () => {
    setOverrideTarget(undefined);
    setOverrideReason("");
  };

  const handleConfirmOverride = () => {
    if (!overrideTarget) return;
    const reason = overrideReason.trim();
    if (reason.length < 10) return;
    overrideGate(overrideTarget.id, reason);
    closeOverrideDialog();
  };

  return (
    <div className="space-y-6">
      {/* Quality Gates */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {gates.map((gate) => {
          const phase = phases.find((p) => p.id === gate.phaseId);
          const evaluation = evaluateGate(gate, testCases, allExecutions, bugs);
          return (
            <Card key={gate.id}>
              <CardHeader className="flex-row items-center justify-between">
                <div>
                  <CardTitle>{phase?.name ?? gate.phaseId} Gate</CardTitle>
                  <p className="text-xs text-muted-foreground mt-1">Requires {gate.requiredPassRate}% pass rate</p>
                </div>
                <Badge variant={gate.status === "Approved" ? "success" : gate.status === "Rejected" ? "danger" : "warning"}>
                  {gate.status}
                </Badge>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-xs text-muted-foreground">
                  Executed {evaluation.metrics.executed}/{evaluation.metrics.totalCases} · Pass rate {evaluation.metrics.passRate}% · Open critical bugs: {evaluation.metrics.openCriticalBugs}
                </p>
                {!evaluation.isReady && gate.status !== "Approved" && (
                  <div className="rounded-md bg-muted/50 p-3 text-xs text-muted-foreground">
                    <p className="font-medium text-foreground mb-1">Blockers:</p>
                    <ul className="list-disc pl-4">
                      {evaluation.reasons.map((r, i) => <li key={i}>{r}</li>)}
                    </ul>
                  </div>
                )}
                {gate.status === "Approved" && (
                  <p className="text-xs text-muted-foreground">
                    Approved{gate.approvedBy ? ` by ${gate.approvedBy}` : ""}{gate.approvedAt ? ` · ${gate.approvedAt.slice(0, 10)}` : ""}
                  </p>
                )}
                {gate.overrideReason && (
                  <p className="text-xs text-amber-600">
                    Override recorded{gate.overriddenBy ? ` by ${gate.overriddenBy}` : ""}: {gate.overrideReason}
                  </p>
                )}
                {gate.status === "Rejected" && gate.rejectedReason && (
                  <p className="text-xs text-destructive">Rejected: {gate.rejectedReason}</p>
                )}
                {gate.status !== "Approved" && (
                  <div className="flex gap-2">
                    <Button size="sm" disabled={!evaluation.isReady} onClick={() => setGateStatus(gate.id, "Approved")}>
                      Approve Gate
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => { setOverrideTarget(gate); setOverrideReason(""); }}>
                      Override
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Phases without a quality gate */}
      {phasesWithoutGate.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Phases without a quality gate</CardTitle></CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {phasesWithoutGate.map((phase) => (
              <Button key={phase.id} size="sm" variant="outline" onClick={() => createGate(projectId, phase.id)}>
                + {phase.name}
              </Button>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Test Cases Table */}
      <Card>
        <CardHeader><CardTitle>Test Cases</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Latest Result</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {testCases.map((tc) => {
                const latest = getLatestExecution(tc.id, getExecutions(tc.id));
                return (
                  <TableRow key={tc.id}>
                    <TableCell className="font-mono text-xs">{tc.id}</TableCell>
                    <TableCell className="font-medium">{tc.title}</TableCell>
                    <TableCell><Badge variant="outline">{tc.type}</Badge></TableCell>
                    <TableCell>
                      {latest ? (
                        <Badge variant={latest.status === "Pass" ? "success" : latest.status === "Fail" ? "danger" : "warning"}>
                          {latest.status}
                        </Badge>
                      ) : (
                        <Badge variant="neutral">Not Run</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="outline" onClick={() => handleOpenExecDialog(tc.id)}>
                        Record Run
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Execution Dialog */}
      <Dialog open={isExecDialogOpen} onOpenChange={setIsExecDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record Test Execution</DialogTitle>
            {selectedCase && (
              <DialogDescription>{selectedCase.id} — {selectedCase.title}</DialogDescription>
            )}
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={execStatus} onValueChange={(v) => setExecStatus(v as ExecutionStatus)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Pass">Pass</SelectItem>
                  <SelectItem value="Fail">Fail</SelectItem>
                  <SelectItem value="Blocked">Blocked</SelectItem>
                  <SelectItem value="Skipped">Skipped</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="exec-notes">Notes</Label>
              <Textarea id="exec-notes" value={execNotes} onChange={(e) => setExecNotes(e.target.value)} placeholder="Any relevant notes or bug references" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsExecDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveExecution}>Save Execution</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Override Dialog */}
      <Dialog open={Boolean(overrideTarget)} onOpenChange={(o) => { if (!o) closeOverrideDialog(); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Override Quality Gate</DialogTitle>
            <DialogDescription>
              The override and its reason are permanently recorded on the gate.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-4">
            <Label htmlFor="override-reason">Reason (minimum 10 characters)</Label>
            <Textarea
              id="override-reason"
              value={overrideReason}
              onChange={(e) => setOverrideReason(e.target.value)}
              placeholder="Explain why this gate is being overridden..."
            />
            <p className="text-xs text-muted-foreground">
              {overrideReason.trim().length}/10 characters minimum.
            </p>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={closeOverrideDialog}>Cancel</Button>
            <Button disabled={overrideReason.trim().length < 10} onClick={handleConfirmOverride}>
              Confirm Override
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}