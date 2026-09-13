import { cn } from "cn";
import type { ConnectionStatus } from "@/generated/prisma/enums";

const TONE: Record<ConnectionStatus, "neutral" | "progress" | "amber" | "done" | "cancel"> = {
  SITE_INSPECTION_PENDING: "neutral",
  SITE_INSPECTION_DONE: "progress",
  SUBSIDY_APPLIED: "amber",
  SUBSIDY_APPROVED: "amber",
  INSTALLATION_IN_PROGRESS: "progress",
  COMPLETED: "done",
  CANCELLED: "cancel",
};

const TONE_CLASSES: Record<string, string> = {
  neutral: "bg-secondary text-muted-foreground",
  progress: "bg-accent text-accent-foreground",
  amber: "bg-[#fbf0dc] text-[#8a5a06] dark:bg-[#3a2c0c] dark:text-[#e8c374]",
  done: "bg-[#e2f3e8] text-[#186a3a] dark:bg-[#123322] dark:text-[#7fd8a3]",
  cancel: "bg-[#fbe4e2] text-[#8c2a22] dark:bg-[#3a1815] dark:text-[#f2a49c]",
};

const DOT_CLASSES: Record<string, string> = {
  neutral: "bg-muted-foreground",
  progress: "bg-primary",
  amber: "bg-[#c98a12]",
  done: "bg-[#2f9e57]",
  cancel: "bg-destructive",
};

export function ConnectionStatusBadge({ status }: { status: ConnectionStatus }) {
  const tone = TONE[status] ?? "neutral";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold",
        TONE_CLASSES[tone],
      )}
    >
      <span className={cn("size-1.5 rounded-full", DOT_CLASSES[tone])} />
      {status.replace(/_/g, " ")}
    </span>
  );
}
