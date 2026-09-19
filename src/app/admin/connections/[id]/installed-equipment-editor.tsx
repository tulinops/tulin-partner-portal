"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useActionFormState } from "@/components/action-form";
import { EQUIPMENT_TYPES } from "@/lib/installationEquipment";
import { SOLAR_BRANDS } from "@/lib/estimateBrands";
import type { InstalledEquipmentItem } from "@/server/connections";

const BRAND_SUGGESTIONS_ID = "installed-equipment-brand-suggestions";
// Radix Select can't take "" as an item value, so the "not tracked" choice
// uses this sentinel and gets translated to/from "" at the edges.
const NO_INVENTORY_ITEM = "none";

type InventoryItemOption = { id: string; name: string; unit: string; runningStock: number };

export function InstalledEquipmentEditor({
  initialItems,
  estimateItems,
  inventoryItems,
}: {
  initialItems: InstalledEquipmentItem[];
  estimateItems: InstalledEquipmentItem[];
  inventoryItems: InventoryItemOption[];
}) {
  const [rows, setRows] = useState<InstalledEquipmentItem[]>(initialItems);
  // The inventory-item picker below is a controlled Select paired with a
  // manually-managed hidden input (no `name` on the Select itself, since its
  // value needs the "none" -> "" translation) — updating that hidden input's
  // value via React re-render doesn't fire a native change event, so a
  // parent ActionForm's disableUntilChanged wouldn't otherwise notice this
  // edit. markDirty() closes that gap explicitly.
  const { markDirty } = useActionFormState();

  function updateRow(i: number, field: keyof InstalledEquipmentItem, value: string) {
    setRows((prev) =>
      prev.map((r, idx) => {
        if (idx !== i) return r;
        if (field === "quantity") return { ...r, quantity: Number(value) || 0 };
        if (field === "inventoryItemId") return { ...r, inventoryItemId: value || undefined };
        return { ...r, [field]: value };
      }),
    );
    if (field === "inventoryItemId") markDirty();
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
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-36">Type</TableHead>
            <TableHead className="w-56">Inventory item</TableHead>
            <TableHead className="w-32">Brand</TableHead>
            <TableHead className="w-32">Model</TableHead>
            <TableHead className="w-32">Serial no.</TableHead>
            <TableHead className="w-20">Qty</TableHead>
            <TableHead className="w-10" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row, i) => (
            <TableRow key={i}>
              <TableCell className="whitespace-normal">
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
              </TableCell>
              <TableCell className="whitespace-normal">
                <input type="hidden" name={`equip_${i}_inventoryItemId`} value={row.inventoryItemId ?? ""} />
                <Select
                  value={row.inventoryItemId ?? NO_INVENTORY_ITEM}
                  onValueChange={(value) =>
                    updateRow(i, "inventoryItemId", value === NO_INVENTORY_ITEM ? "" : value)
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Inventory item" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_INVENTORY_ITEM}>Not tracked in inventory</SelectItem>
                    {inventoryItems.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.name} ({item.runningStock} {item.unit} available)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </TableCell>
              <TableCell className="whitespace-normal">
                <Input
                  name={`equip_${i}_brand`}
                  placeholder="Brand"
                  value={row.brand ?? ""}
                  onChange={(e) => updateRow(i, "brand", e.target.value)}
                  list={BRAND_SUGGESTIONS_ID}
                />
              </TableCell>
              <TableCell className="whitespace-normal">
                <Input
                  name={`equip_${i}_model`}
                  placeholder="Model"
                  value={row.model ?? ""}
                  onChange={(e) => updateRow(i, "model", e.target.value)}
                />
              </TableCell>
              <TableCell className="whitespace-normal">
                <Input
                  name={`equip_${i}_serial`}
                  placeholder="Serial no."
                  value={row.serialNumber ?? ""}
                  onChange={(e) => updateRow(i, "serialNumber", e.target.value)}
                />
              </TableCell>
              <TableCell className="whitespace-normal">
                <Input
                  name={`equip_${i}_qty`}
                  type="number"
                  placeholder="Qty"
                  value={row.quantity || ""}
                  onChange={(e) => updateRow(i, "quantity", e.target.value)}
                />
              </TableCell>
              <TableCell>
                <button
                  type="button"
                  onClick={() => removeRow(i)}
                  className="font-bold text-destructive"
                  title="Remove row"
                >
                  ✕
                </button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" onClick={addRow}>
          + Add item
        </Button>
        {estimateItems.length > 0 && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setRows(estimateItems)}
            title="Replace the rows below with the approved estimate's line items — not saved until you click Save"
          >
            Refill from estimate
          </Button>
        )}
      </div>
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
