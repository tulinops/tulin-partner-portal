"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { selectFinancingMethod } from "@/server/connections";
import type { FinancingMethod } from "@/generated/prisma/enums";

// Single-field, so it saves itself on change instead of needing a separate
// Save button — mirrors the instant-save pattern used for document status.
export function FinancingMethodSelect({
  connectionId,
  initialValue,
}: {
  connectionId: string;
  initialValue: FinancingMethod;
}) {
  const [value, setValue] = useState(initialValue);
  const [pending, startTransition] = useTransition();

  function handleChange(next: string) {
    const method = next as FinancingMethod;
    const previous = value;
    setValue(method);
    startTransition(async () => {
      try {
        const result = await selectFinancingMethod({ connectionId, method });
        if (result?.error) {
          setValue(previous);
          toast.error(result.error);
        } else {
          toast.success("Financing method saved");
        }
      } catch (err) {
        setValue(previous);
        toast.error(err instanceof Error ? err.message : "Something went wrong");
      }
    });
  }

  return (
    <div className="space-y-2">
      <Label htmlFor="financingMethod">Financing method</Label>
      <Select value={value} onValueChange={handleChange} disabled={pending}>
        <SelectTrigger id="financingMethod" className="w-64">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="NOT_SELECTED">Not selected</SelectItem>
          <SelectItem value="FULL_PAYMENT">Full payment (subsidy to customer)</SelectItem>
          <SelectItem value="LOAN">Bank loan</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
