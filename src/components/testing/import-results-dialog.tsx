"use client";

import { useRef, useState } from "react";
import { Upload } from "lucide-react";
import { automatedImportSchema, type AutomatedImportPayload } from "@/lib/testing-schema";
import { matchImportedResults, type ImportPreview } from "@/lib/testing-analytics";
import { useProjects } from "@/lib/project-context";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const SAMPLE_JSON = `{
  "framework": "vitest",
  "buildId": "BUILD-2221",
  "environment": "CI (Node 20)",
  "executedAt": "2024-08-15T07:00:00.000Z",
  "results": [
    { "testCaseId": "TC-06", "status": "Pass" },
    { "testCaseId": "TC-07", "status": "Fail", "message": "Voided invoice counted" }
  ]
}`;

interface ImportResultsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ImportResultsDialog({ open, onOpenChange }: ImportResultsDialogProps) {
  const { getTestCases, createExecution } = useProjects();
  const [raw, setRaw] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [payload, setPayload] = useState<AutomatedImportPayload | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setRaw("");
    setError(null);
    setPayload(null);
    setPreview(null);
    setSummary(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleFile = (file: File | undefined) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setRaw(String(reader.result ?? ""));
    reader.readAsText(file);
  };

  const validate = () => {
    setSummary(null);
    setPayload(null);
    setPreview(null);
    setError(null);
    let json: unknown;
    try {
      json = JSON.parse(raw);
    } catch (err) {
      setError("Invalid JSON: " + (err instanceof Error ? err.message : "parse failed"));
      return;
    }
    const parsed = automatedImportSchema.safeParse(json);
    if (!parsed.success) {
      setError(parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("\n"));
      return;
    }
    setPayload(parsed.data);
    setPreview(matchImportedResults(parsed.data.results, getTestCases()));
  };

  const runImport = () => {
    if (!payload || !preview) return;
    const parsedDate = new Date(payload.executedAt);
    const date = Number.isNaN(parsedDate.getTime()) ? new Date().toISOString() : parsedDate.toISOString();
    preview.matched.forEach((result) => {
      createExecution({
        testCaseId: result.testCaseId,
        status: result.status,
        date,
        environment: payload.environment,
        buildId: payload.buildId,
        actual: result.message || undefined,
        notes: `Imported from ${payload.framework} via validated JSON import.`,
        source: "automated",
      });
    });
    setSummary(
      `Imported ${preview.matched.length} result(s) as automated executions. ` +
        `${preview.unmatched.length} unmatched test-case id(s) were skipped.`
    );
    setPayload(null);
    setPreview(null);
    setRaw("");
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) reset();
      }}
    >
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Import automated results (JSON)</DialogTitle>
          <DialogDescription>
            The UI never executes tests or runs shell commands. Export results from your CI as JSON
            and import them here — every record is validated and marked as automated (spec §5).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
              <Upload className="mr-1.5 h-3.5 w-3.5" /> Choose .json file
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept=".json,application/json"
              className="hidden"
              onChange={(event) => handleFile(event.target.files?.[0])}
            />
            <span className="text-xs text-muted-foreground">or paste below</span>
          </div>

          <Textarea
            rows={8}
            value={raw}
            onChange={(event) => setRaw(event.target.value)}
            placeholder={SAMPLE_JSON}
            className="font-mono text-xs"
          />

          <div className="flex gap-2">
            <Button type="button" variant="secondary" size="sm" onClick={validate} disabled={!raw.trim()}>
              Validate
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={reset}>Clear</Button>
          </div>

          {error && (
            <pre className="whitespace-pre-wrap rounded-md border p-3 text-xs text-red-600">{error}</pre>
          )}

          {summary && (
            <p className="rounded-md border p-3 text-xs text-emerald-700">{summary}</p>
          )}

          {payload && preview && (
            <div className="space-y-2 rounded-md border p-3 text-xs">
              <p className="font-medium">
                {payload.framework} · {payload.buildId} · {payload.environment}
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="success">{preview.matched.length} matched</Badge>
                <Badge variant={preview.unmatched.length > 0 ? "warning" : "neutral"}>
                  {preview.unmatched.length} unmatched
                </Badge>
              </div>
              {preview.unmatched.length > 0 && (
                <p className="text-muted-foreground">
                  Unmatched ids (skipped): {preview.unmatched.map((r) => r.testCaseId).join(", ")}
                </p>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
          <Button onClick={runImport} disabled={!payload || !preview || preview.matched.length === 0}>
            Import {preview ? preview.matched.length : 0} result(s)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}