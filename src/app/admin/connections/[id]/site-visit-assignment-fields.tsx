"use client";

import { useState } from "react";
import Link from "next/link";
import { SubmitButton } from "@/components/action-form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { SiteVisitStatus } from "@/generated/prisma/enums";

const SITE_VISIT_STATUSES = [
  "PENDING",
  "ASSIGNED",
  "SCHEDULED",
  "IN_PROGRESS",
  "COMPLETED",
  "RESCHEDULE_REQUESTED",
  "CANCELLED",
] as const;

function RequiredLabel({ htmlFor, children }: { htmlFor: string; children: React.ReactNode }) {
  return (
    <Label htmlFor={htmlFor}>
      {children} <span className="text-destructive">*</span>
    </Label>
  );
}

export function SiteVisitAssignmentFields({
  staff,
  initialStaffMemberId,
  initialStatus,
  initialScheduledAt,
  initialInstructions,
  canCompleteSiteVisit,
}: {
  staff: { id: string; name: string; phone: string | null }[];
  initialStaffMemberId: string | null;
  initialStatus: SiteVisitStatus;
  initialScheduledAt: string;
  initialInstructions: string;
  canCompleteSiteVisit: boolean;
}) {
  const [staffMemberId, setStaffMemberId] = useState(initialStaffMemberId ?? "");
  const [status, setStatus] = useState<SiteVisitStatus>(initialStatus);
  const [scheduledAt, setScheduledAt] = useState(initialScheduledAt);
  const [instructions, setInstructions] = useState(initialInstructions);

  const isValid = staffMemberId.trim() !== "" && scheduledAt.trim() !== "" && instructions.trim() !== "";

  return (
    <>
      <div className="space-y-2">
        <RequiredLabel htmlFor="staffMemberId">Worker</RequiredLabel>
        <Select
          name="staffMemberId"
          value={staffMemberId}
          onValueChange={setStaffMemberId}
          disabled={staff.length === 0}
        >
          <SelectTrigger id="staffMemberId">
            <SelectValue placeholder={staff.length === 0 ? "No workers added yet" : "Select a worker"} />
          </SelectTrigger>
          <SelectContent>
            {staff.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.name}
                {s.phone ? ` (${s.phone})` : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {staff.length === 0 && (
          <p className="text-xs text-muted-foreground">
            No workers yet —{" "}
            <Link href="/admin/staff" className="underline underline-offset-4">
              add one from Staff
            </Link>
            .
          </p>
        )}
      </div>
      <div className="space-y-2">
        <RequiredLabel htmlFor="siteVisitStatus">Status</RequiredLabel>
        <Select name="siteVisitStatus" value={status} onValueChange={(v) => setStatus(v as SiteVisitStatus)}>
          <SelectTrigger id="siteVisitStatus">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SITE_VISIT_STATUSES.map((s) => (
              <SelectItem key={s} value={s} disabled={s === "COMPLETED" && !canCompleteSiteVisit}>
                {s.replace(/_/g, " ")}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {!canCompleteSiteVisit && (
          <p className="text-xs text-muted-foreground">
            &quot;Completed&quot; unlocks once property inspection and the required site photos (Roof, Meter,
            Install area) are done.
          </p>
        )}
      </div>
      <div className="space-y-2">
        <RequiredLabel htmlFor="siteVisitScheduledAt">Visit date &amp; time</RequiredLabel>
        <Input
          id="siteVisitScheduledAt"
          name="siteVisitScheduledAt"
          type="datetime-local"
          value={scheduledAt}
          onChange={(e) => setScheduledAt(e.target.value)}
        />
      </div>
      <div className="space-y-2 sm:col-span-2">
        <RequiredLabel htmlFor="siteVisitInstructions">Instructions for worker</RequiredLabel>
        <Textarea
          id="siteVisitInstructions"
          name="siteVisitInstructions"
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
        />
      </div>
      <div>
        <SubmitButton disabled={!isValid}>Save assignment</SubmitButton>
      </div>
    </>
  );
}
