"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { updateRequiredDocumentType } from "@/server/documents";

// Single control replacing the old separate "Retire"/"Reactivate" button —
// saves itself on toggle, same instant-save pattern as financing-method-select.tsx.
export function DocumentTypeStatusToggle({ id, initialActive }: { id: string; initialActive: boolean }) {
  const [isActive, setIsActive] = useState(initialActive);
  const [pending, startTransition] = useTransition();

  function handleToggle(next: boolean) {
    const previous = isActive;
    setIsActive(next);
    startTransition(async () => {
      try {
        await updateRequiredDocumentType({ id, isActive: next });
        toast.success(next ? "Document type reactivated" : "Document type retired");
      } catch (err) {
        setIsActive(previous);
        toast.error(err instanceof Error ? err.message : "Something went wrong");
      }
    });
  }

  return (
    <div className="flex items-center gap-2">
      <Switch checked={isActive} onCheckedChange={handleToggle} disabled={pending} aria-label="Active status" />
      <span className="text-sm text-muted-foreground">{isActive ? "Active" : "Retired"}</span>
    </div>
  );
}
