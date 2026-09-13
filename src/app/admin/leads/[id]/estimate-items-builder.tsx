"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { SOLAR_BRANDS, buildBrandLineItems, type SolarBrandValue } from "@/lib/estimateBrands";

export type EstimateBuilderRow = { description: string; spec: string; qty: number; rate: number };
type Row = EstimateBuilderRow;

const DEFAULT_ROWS: Row[] = [
  { description: "Solar PV Module", spec: "", qty: 1, rate: 0 },
  { description: "Solar Inverter", spec: "", qty: 1, rate: 0 },
  { description: "Solar Mounting Structure", spec: "Hot Dip Galvanized / Aluminium Structure", qty: 1, rate: 0 },
  { description: "DC Solar Cable", spec: "UV Resistant DC Solar Cable", qty: 1, rate: 0 },
  { description: "AC Cable", spec: "Copper / Aluminium AC Cable", qty: 1, rate: 0 },
  { description: "MC4 Connectors", spec: "Original Compatible MC4 Connectors", qty: 4, rate: 0 },
  { description: "Earthing & Lightning Protection", spec: "Complete Earthing & Lightning Protection System", qty: 1, rate: 0 },
  { description: "Installation & Commissioning", spec: "Complete Solar System Installation & Commissioning", qty: 1, rate: 0 },
];

const INACTIVE_BRAND_BTN =
  "rounded-md border-2 border-[#16823b] bg-white px-4 py-2 text-sm font-bold text-[#16823b] disabled:cursor-not-allowed disabled:opacity-45";
const ACTIVE_BRAND_BTN =
  "rounded-md border-2 border-[#16823b] bg-[#16823b] px-4 py-2 text-sm font-bold text-white";

function money(n: number) {
  return n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function EstimateItemsBuilder({
  initialCapacity,
  initialBrand,
  initialRows,
  initialGstPercent = 5,
}: {
  initialCapacity?: number;
  initialBrand?: SolarBrandValue;
  initialRows?: Row[];
  initialGstPercent?: number;
} = {}) {
  const [capacity, setCapacity] = useState(initialCapacity ? String(initialCapacity) : "");
  const [brand, setBrand] = useState<SolarBrandValue | "">(initialBrand ?? "");
  const [rows, setRows] = useState<Row[]>(initialRows ?? DEFAULT_ROWS);
  const [gstPercent, setGstPercent] = useState(String(initialGstPercent));

  const capacityValue = parseFloat(capacity);
  const capacityValid = !Number.isNaN(capacityValue) && capacityValue > 0;

  function selectBrand(value: SolarBrandValue, label: string) {
    if (!capacityValid) return;
    setBrand(value);
    setRows((prev) =>
      buildBrandLineItems(label, capacityValue).map((r, i) => ({
        ...r,
        qty: prev[i]?.qty ?? 1,
        rate: prev[i]?.rate ?? 0,
      })),
    );
  }

  function handleCapacityChange(next: string) {
    setCapacity(next);
    const nextValue = parseFloat(next);
    if (brand && !Number.isNaN(nextValue) && nextValue > 0) {
      const label = SOLAR_BRANDS.find((b) => b.value === brand)?.label ?? "";
      setRows((prev) =>
        buildBrandLineItems(label, nextValue).map((r, i) => ({
          ...r,
          qty: prev[i]?.qty ?? 1,
          rate: prev[i]?.rate ?? 0,
        })),
      );
    }
  }

  function updateRow(i: number, field: keyof Row, value: string) {
    setRows((prev) =>
      prev.map((r, idx) =>
        idx === i
          ? { ...r, [field]: field === "qty" || field === "rate" ? Number(value) || 0 : value }
          : r,
      ),
    );
  }

  function addRow() {
    setRows((prev) => [...prev, { description: "", spec: "", qty: 1, rate: 0 }]);
  }

  function removeRow(i: number) {
    setRows((prev) => prev.filter((_, idx) => idx !== i));
  }

  const subtotal = rows.reduce((sum, r) => (r.description.trim() ? sum + r.qty * r.rate : sum), 0);
  const gstAmount = subtotal * ((parseFloat(gstPercent) || 0) / 100);
  const grandTotal = subtotal + gstAmount;

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="systemSizeKw">System size (kW)</Label>
        <Input
          id="systemSizeKw"
          name="systemSizeKw"
          type="number"
          step="0.1"
          value={capacity}
          onChange={(e) => handleCapacityChange(e.target.value)}
        />
      </div>

      <input type="hidden" name="brand" value={brand} />

      <div className="space-y-2">
        <p className="text-sm font-semibold">Select Solar Brand</p>
        <div className="flex flex-wrap gap-2">
          {SOLAR_BRANDS.map((b) => (
            <button
              key={b.value}
              type="button"
              disabled={!capacityValid}
              className={brand === b.value ? ACTIVE_BRAND_BTN : INACTIVE_BRAND_BTN}
              onClick={() => selectBrand(b.value, b.label)}
            >
              {b.label}
            </button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          {capacityValid ? "Now select your solar brand." : "Please enter system capacity in kW first."}
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse text-sm">
          <thead>
            <tr>
              <th className="border p-1 text-left">Description</th>
              <th className="border p-1 text-left">Specification</th>
              <th className="border p-1 text-left">Qty</th>
              <th className="border p-1 text-left">Rate (₹)</th>
              <th className="border p-1 text-right">Amount</th>
              <th className="border p-1" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i}>
                <td className="border p-1">
                  <Input
                    name={`item_${i}_description`}
                    value={row.description}
                    onChange={(e) => updateRow(i, "description", e.target.value)}
                  />
                </td>
                <td className="border p-1">
                  <Input
                    name={`item_${i}_spec`}
                    value={row.spec}
                    onChange={(e) => updateRow(i, "spec", e.target.value)}
                  />
                </td>
                <td className="border p-1">
                  <Input
                    name={`item_${i}_qty`}
                    type="number"
                    step="0.01"
                    className="w-20"
                    value={row.qty || ""}
                    onChange={(e) => updateRow(i, "qty", e.target.value)}
                  />
                </td>
                <td className="border p-1">
                  <Input
                    name={`item_${i}_rate`}
                    type="number"
                    step="0.01"
                    className="w-28"
                    value={row.rate || ""}
                    onChange={(e) => updateRow(i, "rate", e.target.value)}
                  />
                </td>
                <td className="border p-1 text-right font-mono text-muted-foreground">
                  {row.description.trim() ? money(row.qty * row.rate) : "—"}
                </td>
                <td className="border p-1 text-center">
                  <button
                    type="button"
                    onClick={() => removeRow(i)}
                    className="font-bold text-destructive"
                    title="Remove row"
                  >
                    ✕
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="mt-2 flex items-center justify-between">
          <Button type="button" variant="outline" size="sm" onClick={addRow}>
            + Add item
          </Button>
          <p className="text-xs text-muted-foreground">Clear a description to leave that row out of the estimate.</p>
        </div>
      </div>

      <div className="flex flex-col items-end gap-1">
        <div className="w-full max-w-xs space-y-1 text-sm sm:w-72">
          <div className="flex items-center justify-between">
            <Label htmlFor="gstPercent" className="text-muted-foreground">
              GST (%)
            </Label>
            <Input
              id="gstPercent"
              name="gstPercent"
              type="number"
              step="0.01"
              className="w-24 text-right"
              value={gstPercent}
              onChange={(e) => setGstPercent(e.target.value)}
            />
          </div>
          <div className="flex items-center justify-between border-t pt-1">
            <span className="text-muted-foreground">Subtotal</span>
            <span className="font-mono">₹{money(subtotal)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">GST amount</span>
            <span className="font-mono">₹{money(gstAmount)}</span>
          </div>
          <div className="flex items-center justify-between border-t pt-1 text-base font-semibold">
            <span>Total after GST</span>
            <span className="font-mono">₹{money(grandTotal)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
