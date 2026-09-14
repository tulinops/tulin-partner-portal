"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EQUIPMENT_TYPES } from "@/lib/installationEquipment";
import { SOLAR_BRANDS } from "@/lib/estimateBrands";
import type { InstalledEquipmentItem } from "@/server/connections";

const BRAND_SUGGESTIONS_ID = "installed-equipment-brand-suggestions";

export function InstalledEquipmentEditor({ initialItems }: { initialItems: InstalledEquipmentItem[] }) {
  const [rows, setRows] = useState<InstalledEquipmentItem[]>(initialItems);

  function updateRow(i: number, field: keyof InstalledEquipmentItem, value: string) {
    setRows((prev) =>
      prev.map((r, idx) => (idx === i ? { ...r, [field]: field === "quantity" ? Number(value) || 0 : value } : r)),
    );
  }

  function addRow() {
    setRows((prev) => [...prev, { type: "OTHER", quantity: 1 }]);
  }

  function removeRow(i: number) {
    setRows((prev) => prev.filter((_, idx) => idx !== i));
  }

  return (
    <div className="space-y-2">
      {/* Rows can grow past the quotation's own count via "+ Add item" — tell
          the server exactly how many equip_N_* fields to read instead of
          silently truncating past a hardcoded count. */}
      <input type="hidden" name="equipCount" value={rows.length} />
      {rows.map((row, i) => (
        <div key={i} className="grid items-center gap-2 sm:grid-cols-6">
          <Select
            name={`equip_${i}_type`}
            value={row.type}
            onValueChange={(value) => updateRow(i, "type", value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              {EQUIPMENT_TYPES.map((t) => (
                <SelectItem key={t} value={t}>
                  {t.replace(/_/g, " ")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            name={`equip_${i}_brand`}
            placeholder="Brand"
            value={row.brand ?? ""}
            onChange={(e) => updateRow(i, "brand", e.target.value)}
            list={BRAND_SUGGESTIONS_ID}
          />
          <Input
            name={`equip_${i}_model`}
            placeholder="Model"
            value={row.model ?? ""}
            onChange={(e) => updateRow(i, "model", e.target.value)}
          />
          <Input
            name={`equip_${i}_serial`}
            placeholder="Serial no."
            value={row.serialNumber ?? ""}
            onChange={(e) => updateRow(i, "serialNumber", e.target.value)}
          />
          <Input
            name={`equip_${i}_qty`}
            type="number"
            placeholder="Qty"
            value={row.quantity || ""}
            onChange={(e) => updateRow(i, "quantity", e.target.value)}
          />
          <button
            type="button"
            onClick={() => removeRow(i)}
            className="justify-self-start font-bold text-destructive"
            title="Remove row"
          >
            ✕
          </button>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" onClick={addRow}>
        + Add item
      </Button>
      {/* Suggestions only, not a restriction — the Brand field stays plain
          text so equipment from a brand outside this curated solar-panel
          list (mounting hardware, cabling, connectors, etc.) can still be
          typed in freely. */}
      <datalist id={BRAND_SUGGESTIONS_ID}>
        {SOLAR_BRANDS.map((b) => (
          <option key={b.value} value={b.label} />
        ))}
      </datalist>
    </div>
  );
}
