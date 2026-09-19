"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useActionFormState } from "@/components/action-form";
import {
  EQUIPMENT_TYPES,
  WARRANTY_TYPES,
  defaultPeriodMonths,
  defaultWarrantyProductName,
  equipmentOptionLabel,
} from "@/lib/installationEquipment";
import type { InstalledEquipmentItem } from "@/server/connections";

export function WarrantyRecordForm({ installedEquipment }: { installedEquipment: InstalledEquipmentItem[] }) {
  const [selected, setSelected] = useState("custom");
  const item = selected === "custom" ? null : installedEquipment[Number(selected)];
  // This picker has no `name` (it only drives the defaultValues of the
  // fields below via `key`, it isn't itself submitted), so it never fires a
  // native form event a parent ActionForm's disableUntilChanged would see —
  // markDirty() covers the case where someone picks a prefill and submits
  // without separately touching any of the fields it just filled in.
  const { markDirty } = useActionFormState();

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <div className="space-y-2 sm:col-span-3">
        <Label htmlFor="equipmentPicker">Add from installed equipment</Label>
        <Select
          value={selected}
          onValueChange={(value) => {
            setSelected(value);
            markDirty();
          }}
        >
          <SelectTrigger id="equipmentPicker">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="custom">Custom — not tied to a specific item</SelectItem>
            {installedEquipment.map((it, i) => (
              <SelectItem key={i} value={String(i)}>
                {equipmentOptionLabel(it)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="equipmentType">Equipment type</Label>
        <Select key={`type-${selected}`} name="equipmentType" defaultValue={item?.type} required>
          <SelectTrigger id="equipmentType">
            <SelectValue placeholder="Select" />
          </SelectTrigger>
          <SelectContent>
            {EQUIPMENT_TYPES.map((t) => (
              <SelectItem key={t} value={t}>
                {t.replace(/_/g, " ")}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="productName">Product name</Label>
        <Input
          key={`pn-${selected}`}
          id="productName"
          name="productName"
          defaultValue={item ? defaultWarrantyProductName(item) : ""}
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="manufacturer">Manufacturer</Label>
        <Input key={`mf-${selected}`} id="manufacturer" name="manufacturer" defaultValue={item?.brand ?? ""} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="model">Model</Label>
        <Input key={`md-${selected}`} id="model" name="model" defaultValue={item?.model ?? ""} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="serialNumber">Serial number</Label>
        <Input
          key={`sn-${selected}`}
          id="serialNumber"
          name="serialNumber"
          defaultValue={item?.serialNumber ?? ""}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="warrantyType">Warranty type</Label>
        <Select name="warrantyType" defaultValue="PRODUCT">
          <SelectTrigger id="warrantyType">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {WARRANTY_TYPES.map((t) => (
              <SelectItem key={t} value={t}>
                {t.replace(/_/g, " ")}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="startDate">Start date</Label>
        <Input id="startDate" name="startDate" type="date" required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="periodMonths">Period (months)</Label>
        <Input
          key={`pm-${selected}`}
          id="periodMonths"
          name="periodMonths"
          type="number"
          defaultValue={item ? defaultPeriodMonths(item.type) : undefined}
          required
        />
      </div>
      <div className="space-y-2 sm:col-span-2">
        <Label htmlFor="terms">Terms</Label>
        <Input id="terms" name="terms" />
      </div>
    </div>
  );
}
