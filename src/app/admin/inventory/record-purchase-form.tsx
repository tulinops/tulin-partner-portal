"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ActionForm, SubmitButton } from "@/components/action-form";
import type { ActionResult } from "@/lib/actionResult";

type PurchasableItem = { id: string; name: string; brand: string | null };

export function RecordPurchaseForm({
  items,
  action,
}: {
  items: PurchasableItem[];
  action: (formData: FormData) => Promise<ActionResult>;
}) {
  const [brand, setBrand] = useState("");

  return (
    <ActionForm
      action={action}
      successMessage="Purchase recorded"
      disableUntilChanged
      className="grid gap-4 sm:grid-cols-4"
    >
      <div className="space-y-2 sm:col-span-2">
        <Label htmlFor="inventoryItemId">Item</Label>
        <Select
          name="inventoryItemId"
          required
          onValueChange={(id) => setBrand(items.find((item) => item.id === id)?.brand ?? "")}
        >
          <SelectTrigger id="inventoryItemId">
            <SelectValue placeholder="Select item" />
          </SelectTrigger>
          <SelectContent>
            {items.map((item) => (
              <SelectItem key={item.id} value={item.id}>
                {item.name}
                {item.brand ? ` — ${item.brand}` : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="quantity">Quantity</Label>
        <Input id="quantity" name="quantity" type="number" step="0.01" required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="unitCost">Unit cost (₹)</Label>
        <Input id="unitCost" name="unitCost" type="number" step="0.01" required />
      </div>
      <div className="space-y-2 sm:col-span-2">
        <Label htmlFor="purchaseBrand">Brand (optional)</Label>
        {/* Pre-filled from the selected item's own brand — still editable
            for a purchase batch that came from a different brand. */}
        <Input
          id="purchaseBrand"
          name="purchaseBrand"
          value={brand}
          onChange={(e) => setBrand(e.target.value)}
        />
      </div>
      <div className="space-y-2 sm:col-span-2">
        <Label htmlFor="purchaseSupplier">Supplier (optional)</Label>
        <Input id="purchaseSupplier" name="purchaseSupplier" />
      </div>
      <div className="sm:col-span-4">
        <SubmitButton>Record purchase</SubmitButton>
      </div>
    </ActionForm>
  );
}
