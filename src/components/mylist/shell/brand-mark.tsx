"use client";

import { CheckCircle2 } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export function BrandMark({
  size = "md",
  dark = false,
}: {
  size?: "sm" | "md" | "lg";
  dark?: boolean;
}) {
  const { t } = useI18n();
  const boxCls =
    size === "lg"
      ? "size-12 rounded-2xl"
      : size === "md"
        ? "size-10 rounded-xl"
        : "size-8 rounded-lg";
  const iconCls = size === "lg" ? "size-6" : size === "md" ? "size-5" : "size-4";
  const textCls = size === "lg" ? "text-xl" : "text-base";

  return (
    <div className="flex items-center gap-3">
      <div
        className={cn(
          "flex shrink-0 items-center justify-center shadow-md",
          boxCls,
          dark ? "bg-white text-[#1E3A8A]" : "bg-primary text-primary-foreground",
        )}
      >
        <CheckCircle2 className={iconCls} />
      </div>
      {size !== "sm" && (
        <span
          className={cn(
            "font-bold tracking-tight",
            textCls,
            dark ? "text-white" : "text-slate-900",
          )}
        >
          {t("appName")}
        </span>
      )}
    </div>
  );
}
