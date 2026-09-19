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

// Kept as its own small form/action (separate from SiteVisitAssignmentFields
// below) specifically so the status can still be changed — e.g. back to
// Reschedule Requested — while the assignment fields are locked once
// Completed.
export function SiteVisitStatusField({
  initialStatus,
  canCompleteSiteVisit,
}: {
  initialStatus: SiteVisitStatus;
  canCompleteSiteVisit: boolean;
}) {
  const [status, setStatus] = useState<SiteVisitStatus>(initialStatus);

  return (
    <div className="space-y-2">
      <Label htmlFor="siteVisitStatus">Status</Label>
      <div className="flex flex-wrap items-end gap-2">
        <Select name="siteVisitStatus" value={status} onValueChange={(v) => setStatus(v as SiteVisitStatus)}>
          <SelectTrigger id="siteVisitStatus" className="w-56">
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
        <SubmitButton>Save status</SubmitButton>
      </div>
      {!canCompleteSiteVisit && (
        <p className="text-xs text-muted-foreground">
          &quot;Completed&quot; unlocks once property inspection and the required site photos (Roof, Meter,
          Install area) are done.
        </p>
      )}
    </div>
  );
}

export function SiteVisitAssignmentFields({
  staff,
  initialStaffMemberId,
  initialScheduledAt,
  initialInstructions,
  locked,
}: {
  staff: { id: string; name: string; phone: string | null }[];
  initialStaffMemberId: string | null;
  initialScheduledAt: string;
  initialInstructions: string;
  locked: boolean;
}) {
  const [staffMemberId, setStaffMemberId] = useState(initialStaffMemberId ?? "");
  const [scheduledAt, setScheduledAt] = useState(initialScheduledAt);
  const [instructions, setInstructions] = useState(initialInstructions);

  const isValid = staffMemberId.trim() !== "" && scheduledAt.trim() !== "" && instructions.trim() !== "";

  return (
    <>
      {/* display: contents keeps the grid layout intact (the fieldset itself
          isn't a grid item) while still disabling every field inside it. */}
      <fieldset disabled={locked} className="contents">
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
      </fieldset>
      {!locked && (
        <div>
          <SubmitButton disabled={!isValid}>Save assignment</SubmitButton>
        </div>
      )}
    </>
  );
}
