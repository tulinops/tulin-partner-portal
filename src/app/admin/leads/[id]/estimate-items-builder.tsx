"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SOLAR_BRANDS, buildBrandLineItems, type BrandLineItem, type SolarBrandValue } from "@/lib/estimateBrands";

const DEFAULT_ROWS: BrandLineItem[] = [
  { description: "Solar PV Module", spec: "" },
  { description: "Solar Inverter", spec: "" },
  { description: "Solar Mounting Structure", spec: "Hot Dip Galvanized / Aluminium Structure" },
  { description: "DC Solar Cable", spec: "UV Resistant DC Solar Cable" },
  { description: "AC Cable", spec: "Copper / Aluminium AC Cable" },
  { description: "MC4 Connectors", spec: "Original Compatible MC4 Connectors" },
  { description: "Earthing & Lightning Protection", spec: "Complete Earthing & Lightning Protection System" },
  { description: "Installation & Commissioning", spec: "Complete Solar System Installation & Commissioning" },
];

const INACTIVE_BRAND_BTN =
  "rounded-md border-2 border-[#16823b] bg-white px-4 py-2 text-sm font-bold text-[#16823b] disabled:cursor-not-allowed disabled:opacity-45";
const ACTIVE_BRAND_BTN =
  "rounded-md border-2 border-[#16823b] bg-[#16823b] px-4 py-2 text-sm font-bold text-white";

export function EstimateItemsBuilder() {
  const [capacity, setCapacity] = useState("");
  const [brand, setBrand] = useState<SolarBrandValue | "">("");
  const [rows, setRows] = useState<BrandLineItem[]>(DEFAULT_ROWS);

  const capacityValue = parseFloat(capacity);
  const capacityValid = !Number.isNaN(capacityValue) && capacityValue > 0;

  function selectBrand(value: SolarBrandValue, label: string) {
    if (!capacityValid) return;
    setBrand(value);
    setRows(buildBrandLineItems(label, capacityValue));
  }

  function handleCapacityChange(next: string) {
    setCapacity(next);
    const nextValue = parseFloat(next);
    if (brand && !Number.isNaN(nextValue) && nextValue > 0) {
      const label = SOLAR_BRANDS.find((b) => b.value === brand)?.label ?? "";
      setRows(buildBrandLineItems(label, nextValue));
    }
  }

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
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <thead>
            <tr>
              <th className="border p-1 text-left">Description</th>
              <th className="border p-1 text-left">Specification</th>
              <th className="border p-1 text-left">Qty</th>
              <th className="border p-1 text-left">Rate (₹)</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i}>
                <td className="border p-1">
                  <Input
                    name={`item_${i}_description`}
                    value={row.description}
                    onChange={(e) =>
                      setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, description: e.target.value } : r)))
                    }
                  />
                </td>
                <td className="border p-1">
                  <Input
                    name={`item_${i}_spec`}
                    value={row.spec}
                    onChange={(e) =>
                      setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, spec: e.target.value } : r)))
                    }
                  />
                </td>
                <td className="border p-1">
                  <Input name={`item_${i}_qty`} type="number" step="0.01" className="w-20" />
                </td>
                <td className="border p-1">
                  <Input name={`item_${i}_rate`} type="number" step="0.01" className="w-28" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-1 text-xs text-muted-foreground">
          Clear a description to leave that row out of the estimate.
        </p>
      </div>
    </div>
  );
}
