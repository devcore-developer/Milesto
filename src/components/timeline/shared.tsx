"use client";

import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { diffDays, formatArabicDate, formatDaysLeft } from "@/lib/timeline/dates";
import {
  DELIVERABLE_STATUS_LABELS,
  EVENT_KIND_LABELS,
  KIND_DOT_CLASSES,
  PRIORITY_LABELS,
  priorityBadgeVariant,
  statusBadgeVariant,
} from "@/lib/timeline/status";
import type { DeliverablePriority, DeliverableStatus, TimelineEvent, TimelineEventKind } from "@/types/timeline";

export function KindDot({ kind, className = "" }: { kind: TimelineEventKind; className?: string }) {
  return <span aria-hidden className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full ${KIND_DOT_CLASSES[kind]} ${className}`} />;
}

export function StatusBadge({ status }: { status: DeliverableStatus }) {
  return <Badge variant={statusBadgeVariant(status)}>{DELIVERABLE_STATUS_LABELS[status]}</Badge>;
}

export function PriorityBadge({ priority }: { priority: DeliverablePriority }) {
  return <Badge variant={priorityBadgeVariant(priority)}>{PRIORITY_LABELS[priority]}</Badge>;
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-1 rounded-lg border border-dashed py-10 text-center">
      <p className="text-sm font-medium text-muted-foreground">{title}</p>
      {hint ? <p className="text-xs text-muted-foreground/80">{hint}</p> : null}
    </div>
  );
}

// تنسيق مبالغ العرض فقط (integer math — بدون float) — نفس minor units بتاعة المالية
export function formatMoneyMinor(currency: string, minor: number): string {
  const symbols: Record<string, string> = { EGP: "ج.م", USD: "$", EUR: "€", GBP: "£", SAR: "ر.س", AED: "د.إ" };
  const negative = minor < 0;
  const abs = Math.abs(minor);
  const units = Math.floor(abs / 100);
  const cents = abs % 100;
  const grouped = String(units).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${negative ? "-" : ""}${grouped}.${String(cents).padStart(2, "0")} ${symbols[currency] ?? currency}`;
}

export function DaysLeftChip({ date, today }: { date: string; today: string }) {
  const d = diffDays(today, date);
  const tone =
    d < 0 ? "text-red-600 dark:text-red-400" : d <= 3 ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground";
  return <span className={`text-xs font-medium ${tone}`}>{formatDaysLeft(date, today)}</span>;
}

export function EventDialog({
  event,
  open,
  onOpenChange,
}: {
  event: TimelineEvent | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const router = useRouter();
  if (!event) return null;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-right">
            <KindDot kind={event.kind} />
            {event.title}
          </DialogTitle>
          <DialogDescription>{EVENT_KIND_LABELS[event.kind]}</DialogDescription>
        </DialogHeader>
        <div className="space-y-2 text-sm">
          <div className="flex items-center justify-between gap-3">
            <span className="text-muted-foreground">التاريخ</span>
            <span className="font-medium">{formatArabicDate(event.date)}</span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-muted-foreground">المشروع</span>
            <span className="font-medium">{event.projectName}</span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-muted-foreground">الأولوية</span>
            <PriorityBadge priority={event.priority} />
          </div>
          {event.payment ? (
            <div className="rounded-md border bg-muted/40 p-3 space-y-1">
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">قيمة الدفعة</span>
                <span className="font-medium">{formatMoneyMinor(event.payment.currency, event.payment.amountMinor)}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">المحصّل فعلًا</span>
                <span className="font-medium">{formatMoneyMinor(event.payment.currency, event.payment.paidMinor)}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">الحالة</span>
                <Badge variant={event.payment.fullyPaid ? "success" : "warning"}>
                  {event.payment.fullyPaid ? "محصّلة بالكامل" : event.payment.paidMinor > 0 ? "مدفوعة جزئيًا (مخططة)" : "مخططة — غير محصّلة"}
                </Badge>
              </div>
            </div>
          ) : null}
          <div className="flex items-center justify-between gap-3">
            <span className="text-muted-foreground">الوقت المتبقي</span>
            <DaysLeftChip date={event.date} today={event.date <= "" ? event.date : event.date} />
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            إغلاق
          </Button>
          <Button
            variant="subtle"
            onClick={() => {
              onOpenChange(false);
              router.push("/projects");
            }}
          >
            فتح قائمة المشاريع
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}