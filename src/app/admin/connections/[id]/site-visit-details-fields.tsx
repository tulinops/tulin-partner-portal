"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { SiteInspectionDetails } from "@/server/connections";
import type { SiteVisitResult } from "@/generated/prisma/enums";

const ROOF_TYPES = ["RCC", "TIN", "TILED", "OTHER"] as const;
const ROOF_CONDITIONS = ["GOOD", "NEEDS_REPAIR", "POOR"] as const;
const ROOF_ACCESS_OPTIONS = ["EASY", "LADDER_REQUIRED", "DIFFICULT"] as const;
const SITE_VISIT_RESULTS = [
  "SUITABLE",
  "SUITABLE_WITH_CONDITIONS",
  "NOT_SUITABLE",
  "REQUIRES_FURTHER_INSPECTION",
] as const;

function RequiredLabel({ htmlFor, children }: { htmlFor: string; children: React.ReactNode }) {
  return (
    <Label htmlFor={htmlFor}>
      {children} <span className="text-destructive">*</span>
    </Label>
  );
}

// One combined Save for both the property inspection fields and the site
// visit result — they used to be two separate forms/buttons, merged into
// one so a single click saves everything together.
export function SiteVisitDetailsFields({
  initialDetails,
  currentResult,
  initialWorkerNotes,
  photosComplete,
}: {
  initialDetails: SiteInspectionDetails;
  currentResult: SiteVisitResult | null;
  initialWorkerNotes: string;
  photosComplete: boolean;
}) {
  const [roofType, setRoofType] = useState(initialDetails.roofType ?? "");
  const [roofCondition, setRoofCondition] = useState(initialDetails.roofCondition ?? "");
  const [roofAreaSqft, setRoofAreaSqft] = useState(initialDetails.roofAreaSqft?.toString() ?? "");
  const [shadowObstruction, setShadowObstruction] = useState(initialDetails.shadowObstruction ?? "");
  const [orientation, setOrientation] = useState(initialDetails.orientation ?? "");
  const [roofAccess, setRoofAccess] = useState(initialDetails.roofAccess ?? "");
  const [electricalConnectionDetails, setElectricalConnectionDetails] = useState(
    initialDetails.electricalConnectionDetails ?? "",
  );
  const [meterInformation, setMeterInformation] = useState(initialDetails.meterInformation ?? "");
  const [otherRequirements, setOtherRequirements] = useState(initialDetails.otherRequirements ?? "");
  const [result, setResult] = useState<SiteVisitResult | null>(currentResult);

  const inspectionValid = [
    roofType,
    roofCondition,
    roofAreaSqft,
    shadowObstruction,
    orientation,
    roofAccess,
    electricalConnectionDetails,
    meterInformation,
    otherRequirements,
  ].every((v) => v.trim() !== "");
  const isValid = inspectionValid && result !== null;
  const resultUnlocked = inspectionValid && photosComplete;

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-2">
          <RequiredLabel htmlFor="roofType">Roof type</RequiredLabel>
          <Select name="roofType" value={roofType} onValueChange={setRoofType}>
            <SelectTrigger id="roofType">
              <SelectValue placeholder="Select" />
            </SelectTrigger>
            <SelectContent>
              {ROOF_TYPES.map((r) => (
                <SelectItem key={r} value={r}>
                  {r}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <RequiredLabel htmlFor="roofCondition">Roof condition</RequiredLabel>
          <Select name="roofCondition" value={roofCondition} onValueChange={setRoofCondition}>
            <SelectTrigger id="roofCondition">
              <SelectValue placeholder="Select" />
            </SelectTrigger>
            <SelectContent>
              {ROOF_CONDITIONS.map((r) => (
                <SelectItem key={r} value={r}>
                  {r.replace(/_/g, " ")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <RequiredLabel htmlFor="roofAreaSqft">Available roof area (sq. ft)</RequiredLabel>
          <Input
            id="roofAreaSqft"
            name="roofAreaSqft"
            type="number"
            step="0.01"
            value={roofAreaSqft}
            onChange={(e) => setRoofAreaSqft(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <RequiredLabel htmlFor="shadowObstruction">Shadow / obstruction</RequiredLabel>
          <Input
            id="shadowObstruction"
            name="shadowObstruction"
            value={shadowObstruction}
            onChange={(e) => setShadowObstruction(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <RequiredLabel htmlFor="orientation">Direction / orientation</RequiredLabel>
          <Input
            id="orientation"
            name="orientation"
            value={orientation}
            onChange={(e) => setOrientation(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <RequiredLabel htmlFor="roofAccess">Access to roof</RequiredLabel>
          <Select name="roofAccess" value={roofAccess} onValueChange={setRoofAccess}>
            <SelectTrigger id="roofAccess">
              <SelectValue placeholder="Select" />
            </SelectTrigger>
            <SelectContent>
              {ROOF_ACCESS_OPTIONS.map((r) => (
                <SelectItem key={r} value={r}>
                  {r.replace(/_/g, " ")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <RequiredLabel htmlFor="electricalConnectionDetails">Electrical connection details</RequiredLabel>
          <Input
            id="electricalConnectionDetails"
            name="electricalConnectionDetails"
            value={electricalConnectionDetails}
            onChange={(e) => setElectricalConnectionDetails(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <RequiredLabel htmlFor="meterInformation">Meter information</RequiredLabel>
          <Input
            id="meterInformation"
            name="meterInformation"
            value={meterInformation}
            onChange={(e) => setMeterInformation(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <RequiredLabel htmlFor="otherRequirements">Other requirements</RequiredLabel>
          <Input
            id="otherRequirements"
            name="otherRequirements"
            value={otherRequirements}
            onChange={(e) => setOtherRequirements(e.target.value)}
          />
        </div>
      </div>

      <div className="space-y-4 border-t pt-6">
        <div>
          <Label className="mb-2 block">
            Result <span className="text-destructive">*</span>
          </Label>
          {!resultUnlocked && (
            <p className="mb-2 text-sm font-medium text-amber-900 dark:text-amber-200">
              {!inspectionValid
                ? "Fill in all inspection fields above to unlock the result."
                : "Upload Roof/Meter/Install area photos to unlock the result."}
            </p>
          )}
          <input type="hidden" name="result" value={result ?? ""} />
          <div className="flex flex-wrap gap-2">
            {SITE_VISIT_RESULTS.map((r) => (
              <Button
                key={r}
                type="button"
                variant={r === result ? "default" : "outline"}
                size="sm"
                disabled={!resultUnlocked}
                onClick={() => setResult(r)}
              >
                {r.replace(/_/g, " ")}
              </Button>
            ))}
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="workerNotes">Worker notes</Label>
          <Textarea id="workerNotes" name="workerNotes" defaultValue={initialWorkerNotes} />
        </div>
      </div>

      <div>
        <Button type="submit" disabled={!isValid || !photosComplete}>
          Save
        </Button>
      </div>
    </>
  );
}
