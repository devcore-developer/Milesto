"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { GateStatusBadge } from "@/components/testing/testing-badges";
import { evaluateGate } from "@/lib/quality-engine";
import { useProjects } from "@/lib/project-context";
import type { QualityGate } from "@/types";

interface CriteriaDraft {
  requiredExecuted: number;
  requiredPassed: number;
  requiredPassRate: number;
  requireNoCriticalBugs: boolean;
  requireNoHighBugs: boolean;
  requireManualApproval: boolean;
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (next: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className={`rounded-md border px-3 py-1.5 text-xs font-medium transition ${value ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background text-muted-foreground hover:text-foreground"}`}
    >
      {label}: {value ? "Required" : "Off"}
    </button>
  );
}

export function QualityGatesPanel() {
  const {
    projects, phases,
    getGates, getTestCases, getAllExecutions, getBugs,
    updateGateCriteria, setGateStatus, overrideGate, createGate,
  } = useProjects();

  const [projectFilter, setProjectFilter] = useState("");
  const [editingGateId, setEditingGateId] = useState<string | null>(null);
  const [draft, setDraft] = useState<CriteriaDraft | null>(null);
  const [rejectingGateId, setRejectingGateId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [overrideGateId, setOverrideGateId] = useState<string | null>(null);
  const [overrideReason, setOverrideReason] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);

  const gates = getGates();
  const testCases = getTestCases();
  const executions = getAllExecutions();
  const bugs = getBugs();

  const visibleGates = gates.filter((g) => !projectFilter || g.projectId === projectFilter);
  const gatedPhaseIds = new Set(gates.map((g) => g.phaseId));
  const ungatedPhases = phases.filter((p) => (!projectFilter || p.projectId === projectFilter) && !gatedPhaseIds.has(p.id));

  function openCriteria(gate: QualityGate) {
    setEditingGateId(gate.id);
    setDraft({
      requiredExecuted: gate.requiredExecuted,
      requiredPassed: gate.requiredPassed,
      requiredPassRate: gate.requiredPassRate,
      requireNoCriticalBugs: gate.requireNoCriticalBugs,
      requireNoHighBugs: gate.requireNoHighBugs,
      requireManualApproval: gate.requireManualApproval,
    });
  }

  function saveCriteria(gate: QualityGate) {
    if (!draft) return;
    updateGateCriteria(gate.id, draft);
    setEditingGateId(null);
    setDraft(null);
  }

  function handleReject(gate: QualityGate) {
    if (rejectReason.trim().length < 5) {
      setActionError("Give a rejection reason of at least 5 characters so the team knows what to fix.");
      return;
    }
    setGateStatus(gate.id, "Rejected", { reason: rejectReason.trim() });
    setRejectingGateId(null);
    setRejectReason("");
    setActionError(null);
  }

  function handleOverride(gate: QualityGate) {
    if (overrideReason.trim().length < 10) {
      setActionError("Overrides need a reason of at least 10 characters — it is recorded on the gate permanently.");
      return;
    }
    overrideGate(gate.id, overrideReason.trim());
    setOverrideGateId(null);
    setOverrideReason("");
    setActionError(null);
  }

  return (
    <div className="grid gap-4">
      <div className="card-surface flex flex-wrap items-end gap-3 p-4">
        <div className="grid gap-1">
          <label className="text-xs font-medium text-muted-foreground">Project</label>
          <Select value={projectFilter || "all"} onValueChange={(v) => setProjectFilter(v === "all" ? "" : v)}>
            <SelectTrigger className="w-52"><SelectValue placeholder="All projects" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All projects</SelectItem>
              {projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <p className="pb-2 text-xs text-muted-foreground">A gate must meet every criterion before its phase can be approved. Overrides stay recorded on the gate permanently.</p>
      </div>

      {actionError ? (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-2.5 text-sm text-amber-800">{actionError}</div>
      ) : null}

      {visibleGates.map((gate) => {
        const readiness = evaluateGate(gate, testCases, executions, bugs);
        const phase = phases.find((p) => p.id === gate.phaseId);
        const project = projects.find((p) => p.id === gate.projectId);
        const isEditing = editingGateId === gate.id;
        return (
          <div key={gate.id} className="card-surface grid gap-4 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="grid gap-1">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs text-muted-foreground">{gate.id}</span>
                  <GateStatusBadge status={gate.status} />
                </div>
                <h3 className="text-base font-semibold">{phase?.name ?? gate.phaseId}</h3>
                <p className="text-xs text-muted-foreground">{project?.name ?? gate.projectId}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {gate.status === "Pending" || gate.status === "Rejected" ? (
                  <Button variant="subtle" onClick={() => setGateStatus(gate.id, "Ready for Review")}>Submit for review</Button>
                ) : null}
                {gate.status === "Ready for Review" ? (
                  <Button onClick={() => setGateStatus(gate.id, "Approved")}>Approve</Button>
                ) : null}
                {gate.status === "Ready for Review" || gate.status === "Approved" ? (
                  <Button variant="subtle" onClick={() => { setRejectingGateId(rejectingGateId === gate.id ? null : gate.id); setRejectReason(""); }}>Reject</Button>
                ) : null}
                {gate.status === "Approved" || gate.status === "Rejected" ? (
                  <Button variant="subtle" onClick={() => setGateStatus(gate.id, "Pending")}>Revert to pending</Button>
                ) : null}
                {gate.status === "Blocked" ? (
                  <Button variant="subtle" onClick={() => setGateStatus(gate.id, "Pending")}>Unblock</Button>
                ) : (
                  <Button variant="subtle" onClick={() => setGateStatus(gate.id, "Blocked")}>Block</Button>
                )}
              </div>
            </div>

            <div className="grid gap-3 rounded-lg border bg-muted/30 p-3 sm:grid-cols-2">
              <div className="grid content-start gap-1.5 text-sm">
                <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Metrics</span>
                <span>Executed: <b>{readiness.metrics.executed}</b> / required {gate.requiredExecuted}</span>
                <span>Passed: <b>{readiness.metrics.passed}</b> / required {gate.requiredPassed}</span>
                <span>Pass rate: <b>{readiness.metrics.passRate}%</b> / required {gate.requiredPassRate}%</span>
                <span>Open critical bugs: <b>{readiness.metrics.openCriticalBugs}</b></span>
                <span>Open high bugs: <b>{readiness.metrics.openHighBugs}</b></span>
              </div>
              <div className="grid content-start gap-1.5 text-sm">
                <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Readiness</span>
                {readiness.isReady ? (
                  <span className="text-emerald-600">✓ All criteria are met — ready for approval.</span>
                ) : (
                  readiness.reasons.map((reason) => (
                    <span key={reason} className="text-red-600">✗ {reason}</span>
                  ))
                )}
              </div>
            </div>

            <div className="grid gap-2">
              <p className="text-xs text-muted-foreground">
                Criteria: ≥{gate.requiredExecuted} executed · ≥{gate.requiredPassed} passed · ≥{gate.requiredPassRate}% pass rate
                {gate.requireNoCriticalBugs ? " · no open Critical bugs" : ""}
                {gate.requireNoHighBugs ? " · no open High bugs" : ""}
                {gate.requireManualApproval ? " · manual approval" : ""}
              </p>
              {isEditing && draft ? (
                <div className="grid gap-3 rounded-lg border p-3">
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="grid gap-1">
                      <label className="text-xs text-muted-foreground">Required executed</label>
                      <Input type="number" min={0} value={draft.requiredExecuted} onChange={(e) => setDraft({ ...draft, requiredExecuted: Number(e.target.value) })} />
                    </div>
                    <div className="grid gap-1">
                      <label className="text-xs text-muted-foreground">Required passed</label>
                      <Input type="number" min={0} value={draft.requiredPassed} onChange={(e) => setDraft({ ...draft, requiredPassed: Number(e.target.value) })} />
                    </div>
                    <div className="grid gap-1">
                      <label className="text-xs text-muted-foreground">Required pass rate (%)</label>
                      <Input type="number" min={0} max={100} value={draft.requiredPassRate} onChange={(e) => setDraft({ ...draft, requiredPassRate: Number(e.target.value) })} />
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Toggle label="No Critical bugs" value={draft.requireNoCriticalBugs} onChange={(v) => setDraft({ ...draft, requireNoCriticalBugs: v })} />
                    <Toggle label="No High bugs" value={draft.requireNoHighBugs} onChange={(v) => setDraft({ ...draft, requireNoHighBugs: v })} />
                    <Toggle label="Manual approval" value={draft.requireManualApproval} onChange={(v) => setDraft({ ...draft, requireManualApproval: v })} />
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={() => saveCriteria(gate)}>Save criteria</Button>
                    <Button variant="subtle" onClick={() => { setEditingGateId(null); setDraft(null); }}>Cancel</Button>
                  </div>
                </div>
              ) : (
                <Button variant="subtle" className="w-fit" onClick={() => openCriteria(gate)}>Edit criteria</Button>
              )}
            </div>

            {rejectingGateId === gate.id ? (
              <div className="grid gap-2 rounded-lg border border-red-200 bg-red-50 p-3">
                <label className="text-xs font-medium text-red-700">Rejection reason</label>
                <Textarea value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} rows={2} placeholder="What must change before this phase can pass?" />
                <div className="flex gap-2">
                  <Button className="bg-red-600 hover:bg-red-700" onClick={() => handleReject(gate)}>Confirm rejection</Button>
                  <Button variant="subtle" onClick={() => setRejectingGateId(null)}>Cancel</Button>
                </div>
              </div>
            ) : null}

            {gate.status !== "Approved" && !readiness.isReady ? (
              overrideGateId === gate.id ? (
                <div className="grid gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3">
                  <label className="text-xs font-medium text-amber-800">Override reason (min 10 characters, permanently recorded)</label>
                  <Textarea value={overrideReason} onChange={(e) => setOverrideReason(e.target.value)} rows={2} placeholder="Why is it acceptable to approve this phase now?" />
                  <div className="flex gap-2">
                    <Button onClick={() => handleOverride(gate)}>Override & approve</Button>
                    <Button variant="subtle" onClick={() => setOverrideGateId(null)}>Cancel</Button>
                  </div>
                </div>
              ) : (
                <Button variant="subtle" className="w-fit" onClick={() => { setOverrideGateId(gate.id); setOverrideReason(""); }}>Override…</Button>
              )
            ) : null}

            {gate.approvedBy ? (
              <p className="text-xs text-muted-foreground">Approved by {gate.approvedBy}{gate.approvedAt ? ` · ${String(gate.approvedAt).slice(0, 10)}` : ""}</p>
            ) : null}
            {gate.rejectedReason ? <p className="text-xs text-red-600">Rejected: {gate.rejectedReason}</p> : null}
            {gate.overrideReason ? (
              <p className="text-xs text-amber-700">
                Override by {gate.overriddenBy ?? "—"}: {gate.overrideReason}{gate.overriddenAt ? ` · ${String(gate.overriddenAt).slice(0, 10)}` : ""}
              </p>
            ) : null}
          </div>
        );
      })}

      {visibleGates.length === 0 ? (
        <p className="text-sm text-muted-foreground">No quality gates yet for this selection.</p>
      ) : null}

      {ungatedPhases.length > 0 ? (
        <div className="card-surface grid gap-3 p-4">
          <div className="grid gap-1">
            <h3 className="text-sm font-semibold">Phases without a quality gate</h3>
            <p className="text-xs text-muted-foreground">Create a gate to start tracking exit criteria for these phases.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {ungatedPhases.map((p) => (
              <Button key={p.id} variant="subtle" onClick={() => createGate(p.projectId, p.id)}>+ Gate for {p.name}</Button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}