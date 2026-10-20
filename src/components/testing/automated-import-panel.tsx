"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { automatedImportSchema, type AutomatedImportPayload } from "@/lib/testing-schema";
import { matchImportedResults } from "@/lib/testing-analytics";
import { useProjects } from "@/lib/project-context";

const SAMPLE = JSON.stringify(
  {
    framework: "vitest",
    buildId: "build-241",
    environment: "ci",
    executedAt: "2026-02-10",
    results: [
      { testCaseId: "TC-01", status: "Pass", message: "All assertions passed", durationMs: 1240 },
      { testCaseId: "TC-02", status: "Fail", message: "Expected 200, got 500" },
    ],
  },
  null,
  2,
);

function idOf(item: unknown): string {
  if (typeof item === "string") return item;
  const candidate = item as { testCaseId?: string; id?: string } | null;
  return candidate?.testCaseId ?? candidate?.id ?? String(item);
}

export function AutomatedImportPanel() {
  const { getAllTestCases, createExecution } = useProjects();
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [issues, setIssues] = useState<string[]>([]);
  const [parsed, setParsed] = useState<AutomatedImportPayload | null>(null);
  const [preview, setPreview] = useState<{ matched: unknown[]; unmatched: unknown[] } | null>(null);
  const [importedCount, setImportedCount] = useState(0);

  const allCases = getAllTestCases();
  const caseById = new Map(allCases.map((c) => [c.id, c]));

  function onValidate() {
    setError(null);
    setIssues([]);
    setParsed(null);
    setPreview(null);
    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch (e) {
      setError(`Invalid JSON: ${e instanceof Error ? e.message : "could not parse"}`);
      return;
    }
    const result = automatedImportSchema.safeParse(json);
    if (!result.success) {
      setIssues(result.error.issues.map((i) => `${i.path.join(".") || "payload"}: ${i.message}`));
      return;
    }
    const match = matchImportedResults(result.data.results, allCases);
    setParsed(result.data);
    setPreview({ matched: match.matched as unknown[], unmatched: match.unmatched as unknown[] });
  }

  function onImport() {
    if (!parsed || !preview) return;
    const matchedIds = new Set(preview.matched.map((m) => idOf(m)));
    const toImport = parsed.results.filter((r) => matchedIds.has(r.testCaseId));
    for (const result of toImport) {
      createExecution({
        testCaseId: result.testCaseId,
        status: result.status,
        date: parsed.executedAt,
        source: "automated",
        environment: parsed.environment,
        buildId: parsed.buildId,
        notes: result.message,
      });
    }
    setImportedCount(toImport.length);
    setParsed(null);
    setPreview(null);
    setText("");
  }

  return (
    <div className="card-surface grid gap-4 p-4">
      <div className="grid gap-1">
        <h2 className="text-sm font-semibold">Import CI results (JSON)</h2>
        <p className="text-xs text-muted-foreground">
          Milesto never executes automation from the UI — no shell commands, no test runners. Your CI pipeline runs the
          tests and posts a JSON report here; importing only records executions against existing case IDs.
        </p>
      </div>
      <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={10} className="font-mono text-xs" placeholder={SAMPLE} />
      <div className="flex flex-wrap gap-2">
        <Button variant="subtle" onClick={onValidate} disabled={!text.trim()}>Validate & preview</Button>
        {parsed && preview ? <Button onClick={onImport}>Import {preview.matched.length} matched result(s)</Button> : null}
        <Button variant="ghost" onClick={() => { setText(""); setError(null); setIssues([]); setParsed(null); setPreview(null); setImportedCount(0); }}>Clear</Button>
      </div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {issues.length > 0 ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <p className="font-medium">Schema issues:</p>
          <ul className="list-disc ps-5">
            {issues.map((i) => <li key={i}>{i}</li>)}
          </ul>
        </div>
      ) : null}
      {parsed && preview ? (
        <>
          <p className="text-xs text-muted-foreground">
            Framework {parsed.framework} · build {parsed.buildId || "—"} · environment {parsed.environment || "—"} · executed {parsed.executedAt}
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border p-3">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Matched ({preview.matched.length})</p>
              <ul className="mt-2 grid gap-1 text-sm">
                {preview.matched.map((m) => {
                  const id = idOf(m);
                  return <li key={id} className="text-emerald-700">✓ {id} — {caseById.get(id)?.title ?? ""}</li>;
                })}
              </ul>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Unmatched ({preview.unmatched.length})</p>
              {preview.unmatched.length === 0 ? (
                <p className="mt-2 text-sm text-muted-foreground">Everything matches — safe to import.</p>
              ) : (
                <ul className="mt-2 grid gap-1 text-sm">
                  {preview.unmatched.map((u) => {
                    const id = idOf(u);
                    return <li key={id} className="text-red-600">✗ {id} — no test case with this ID</li>;
                  })}
                </ul>
              )}
            </div>
          </div>
        </>
      ) : null}
      {importedCount > 0 ? (
        <p className="text-sm text-emerald-700">Imported {importedCount} execution record(s) as automated results.</p>
      ) : null}
    </div>
  );
}