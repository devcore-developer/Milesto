"use client";

import { Bug, FileText, FlaskConical, History, Scale, Users, Wrench } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { DecisionStatus, KnowledgeNoteType } from "@/types/notes";

const TYPE_ICONS: Record<KnowledgeNoteType, LucideIcon> = {
  General: FileText,
  Technical: Wrench,
  Meeting: Users,
  Decision: Scale,
  "Bug Investigation": Bug,
  Research: FlaskConical,
  Retrospective: History,
};

const TYPE_VARIANTS: Record<
  KnowledgeNoteType,
  "outline" | "info" | "neutral" | "warning" | "danger" | "success"
> = {
  General: "outline",
  Technical: "info",
  Meeting: "neutral",
  Decision: "warning",
  "Bug Investigation": "danger",
  Research: "success",
  Retrospective: "info",
};

const DECISION_VARIANTS: Record<DecisionStatus, "warning" | "success" | "danger" | "neutral"> = {
  Proposed: "warning",
  Accepted: "success",
  Rejected: "danger",
  Superseded: "neutral",
};

export function NoteTypeBadge({ type }: { type: KnowledgeNoteType }) {
  const Icon = TYPE_ICONS[type];
  return (
    <Badge variant={TYPE_VARIANTS[type]}>
      <Icon className="mr-1 h-3 w-3" />
      {type}
    </Badge>
  );
}

export function DecisionStatusBadge({ status }: { status: DecisionStatus }) {
  return <Badge variant={DECISION_VARIANTS[status]}>{status}</Badge>;
}