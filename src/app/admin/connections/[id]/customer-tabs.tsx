"use client";

import { useState, type ReactNode } from "react";
import { cn } from "cn";
import { STAGE_ORDER, STAGE_LABELS, type ConnectionStageKey } from "@/lib/connectionStage";

type TabKey = Exclude<ConnectionStageKey, "completed"> | "overview" | "activity" | "invoice";

const TABS: { key: TabKey; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "lead", label: "Lead" },
  { key: "estimate", label: "Estimate" },
  { key: "sitevisit", label: "Site Visit" },
  { key: "documents", label: "Documents" },
  { key: "subsidyloan", label: "Payments" },
  { key: "installation", label: "Installation" },
  { key: "invoice", label: "Invoice" },
  { key: "warranty", label: "Warranty" },
  { key: "activity", label: "Activity / Notes" },
];

export function CustomerTabs({
  currentStage,
  overview,
  lead,
  estimate,
  sitevisit,
  documents,
  subsidyloan,
  installation,
  invoice,
  warranty,
  activity,
}: {
  currentStage: ConnectionStageKey;
  overview: ReactNode;
  lead: ReactNode;
  estimate: ReactNode;
  sitevisit: ReactNode;
  documents: ReactNode;
  subsidyloan: ReactNode;
  installation: ReactNode;
  invoice: ReactNode;
  warranty: ReactNode;
  activity: ReactNode;
}) {
  const [active, setActive] = useState<TabKey>(
    currentStage === "completed" ? "installation" : currentStage,
  );

  const sections: Record<TabKey, ReactNode> = {
    overview,
    lead,
    estimate,
    sitevisit,
    documents,
    subsidyloan,
    installation,
    invoice,
    warranty,
    activity,
  };

  const currentIdx = STAGE_ORDER.indexOf(currentStage);

  return (
    <div className="space-y-6">
      <div className="flex items-start overflow-x-auto pb-1" aria-label="Customer lifecycle progress">
        {STAGE_ORDER.map((key, idx) => (
          <div key={key} className="relative flex min-w-[84px] flex-1 flex-col items-center gap-1.5">
            {idx < STAGE_ORDER.length - 1 && (
              <div
                className={cn("absolute top-3 h-0.5", idx < currentIdx ? "bg-primary" : "bg-border")}
                style={{ left: "calc(50% + 14px)", right: "calc(-50% + 14px)" }}
              />
            )}
            <div
              className={cn(
                "z-10 flex size-6 items-center justify-center rounded-full border-2 text-xs font-bold",
                idx < currentIdx
                  ? "border-primary bg-primary text-primary-foreground"
                  : idx === currentIdx
                    ? "border-primary text-primary ring-4 ring-accent"
                    : "border-border bg-card text-muted-foreground",
              )}
            >
              {idx < currentIdx ? "✓" : idx === currentIdx ? "●" : idx + 1}
            </div>
            <span
              className={cn(
                "text-center text-[11px] leading-tight font-semibold text-balance",
                idx <= currentIdx ? "text-foreground" : "text-muted-foreground",
              )}
            >
              {STAGE_LABELS[key]}
            </span>
          </div>
        ))}
      </div>

      <div className="flex gap-1 overflow-x-auto border-b border-border">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setActive(t.key)}
            className={cn(
              "shrink-0 border-b-2 px-3 py-2 text-sm font-semibold whitespace-nowrap transition-colors",
              active === t.key
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div>{sections[active]}</div>
    </div>
  );
}
