"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { SOLAR_BRANDS, buildBrandLineItems, brandLabel, type SolarBrandValue } from "@/lib/estimateBrands";
import { amountInWords } from "@/lib/amountInWords";

export type EstimateBuilderRow = { description: string; spec: string; qty: number; rate: number };

export const DEFAULT_ROWS: EstimateBuilderRow[] = [
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

export function EstimateBuilderWithPreview({
  customerName,
  phone,
  email,
  address,
  tenantName,
  tenantAddress,
  tenantGstin,
  tenantPhone,
  tenantEmail,
  defaultValidUntil,
  initialCapacity,
  initialBrand,
  initialRows,
  initialGstPercent = 5,
  initialSubsidyEstimate,
  initialNotes,
  locked = false,
}: {
  customerName: string;
  phone: string;
  email?: string | null;
  address?: string | null;
  tenantName: string;
  tenantAddress?: string | null;
  tenantGstin?: string | null;
  tenantPhone?: string | null;
  tenantEmail?: string | null;
  defaultValidUntil: string;
  initialCapacity?: number;
  initialBrand?: SolarBrandValue;
  initialRows?: EstimateBuilderRow[];
  initialGstPercent?: number;
  initialSubsidyEstimate?: number;
  initialNotes: string;
  locked?: boolean;
}) {
  const [capacity, setCapacity] = useState(initialCapacity ? String(initialCapacity) : "");
  const [brand, setBrand] = useState<SolarBrandValue | "">(initialBrand ?? "");
  const [rows, setRows] = useState<EstimateBuilderRow[]>(initialRows ?? DEFAULT_ROWS);
  const [gstPercent, setGstPercent] = useState(String(initialGstPercent));
  const [subsidyEstimate, setSubsidyEstimate] = useState(
    initialSubsidyEstimate ? String(initialSubsidyEstimate) : "",
  );
  const [validUntil, setValidUntil] = useState(defaultValidUntil);
  const [notes, setNotes] = useState(initialNotes);
  const [showPreview, setShowPreview] = useState(false);

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

  function updateRow(i: number, field: keyof EstimateBuilderRow, value: string) {
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

  const visibleRows = rows.filter((r) => r.description.trim());
  const subtotal = visibleRows.reduce((sum, r) => sum + r.qty * r.rate, 0);
  const gstAmount = subtotal * ((parseFloat(gstPercent) || 0) / 100);
  const grandTotal = subtotal + gstAmount;
  const subsidyValue = parseFloat(subsidyEstimate) || 0;
  const netPayable = grandTotal - subsidyValue;

  return (
    <div>
      <fieldset disabled={locked} className="space-y-4 disabled:opacity-60">
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
            <p className="text-xs text-muted-foreground">Clear a description to leave that row out.</p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="gstPercent">GST (%)</Label>
            <Input
              id="gstPercent"
              name="gstPercent"
              type="number"
              step="0.01"
              value={gstPercent}
              onChange={(e) => setGstPercent(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="subsidyEstimate">Est. government subsidy (₹)</Label>
            <Input
              id="subsidyEstimate"
              name="subsidyEstimate"
              type="number"
              step="0.01"
              value={subsidyEstimate}
              onChange={(e) => setSubsidyEstimate(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="validUntil">Valid until</Label>
            <Input
              id="validUntil"
              name="validUntil"
              type="date"
              value={validUntil}
              onChange={(e) => setValidUntil(e.target.value)}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="notes">Terms &amp; conditions</Label>
          <Textarea id="notes" name="notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={8} />
        </div>
      </fieldset>

      <div className="mt-4">
        <Dialog open={showPreview} onOpenChange={setShowPreview}>
          <DialogTrigger asChild>
            <Button type="button" variant="outline" size="sm">
              Preview estimate
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
            <DialogTitle>Live preview</DialogTitle>
            <div
              className="min-w-0 space-y-3 rounded-md border bg-white p-4 text-[#1c1c1c] shadow-sm"
              style={{ fontFamily: "Arial, Helvetica, sans-serif" }}
            >
          <div className="border-b-[3px] border-[#16823b] pb-2 text-center">
            <p className="text-sm font-extrabold tracking-wide text-balance text-[#08752f] uppercase">
              {tenantName}
            </p>
            {tenantAddress && <p className="mt-0.5 text-[10px] break-words">{tenantAddress}</p>}
            <p className="mt-0.5 text-[10px] font-bold break-words">
              {tenantGstin && <span className="text-[#b00000]">GST: {tenantGstin}</span>}
              {tenantGstin && (tenantPhone || tenantEmail) ? " | " : ""}
              {tenantPhone}
              {tenantPhone && tenantEmail ? " | " : ""}
              {tenantEmail}
            </p>
          </div>

          <p className="text-center text-xs font-semibold underline">Solar System Estimate</p>

          <div className="space-y-0.5 text-[11px]">
            <p>
              <span className="text-muted-foreground">Customer:</span> {customerName}
            </p>
            <p>
              <span className="text-muted-foreground">Phone / Email:</span> {phone}
              {email ? ` · ${email}` : ""}
            </p>
            {address && (
              <p>
                <span className="text-muted-foreground">Address:</span> {address}
              </p>
            )}
            <p>
              <span className="text-muted-foreground">Valid until:</span>{" "}
              {validUntil ? new Date(validUntil).toLocaleDateString("en-IN") : "—"}
            </p>
          </div>

          <p className="text-[11px] font-bold text-[#08752f]">
            System Capacity: {capacityValid ? `${capacity} kW` : "Not selected"}
          </p>
          <p className="text-[11px] font-bold text-[#08752f]">
            Selected Brand: {brandLabel(brand) ?? "Not selected"}
          </p>

          <table className="w-full table-fixed border-collapse text-[10px]">
            <thead>
              <tr className="bg-[#16823b] text-white">
                <th className="border border-[#0c5b29] p-1 text-left">Description</th>
                <th className="w-10 border border-[#0c5b29] p-1 text-right">Qty</th>
                <th className="w-16 border border-[#0c5b29] p-1 text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.length === 0 ? (
                <tr>
                  <td colSpan={3} className="border border-[#999] p-1 text-center text-muted-foreground">
                    No items yet
                  </td>
                </tr>
              ) : (
                visibleRows.map((r, i) => (
                  <tr key={i}>
                    <td className="border border-[#999] p-1 break-words">{r.description}</td>
                    <td className="border border-[#999] p-1 text-right">{r.qty}</td>
                    <td className="border border-[#999] p-1 text-right break-words">{money(r.qty * r.rate)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          <table className="w-full table-fixed border-collapse text-[10px]">
            <tbody>
              <tr>
                <td className="border border-[#999] bg-[#f2f7f3] p-1 font-semibold">Subtotal</td>
                <td className="border border-[#999] p-1 text-right break-words">₹{money(subtotal)}</td>
              </tr>
              <tr>
                <td className="border border-[#999] bg-[#f2f7f3] p-1 font-semibold">GST ({gstPercent || 0}%)</td>
                <td className="border border-[#999] p-1 text-right">₹{money(gstAmount)}</td>
              </tr>
              <tr className="bg-[#16823b] text-white">
                <td className="border border-[#0c5b29] p-1 font-semibold">Grand Total</td>
                <td className="border border-[#0c5b29] p-1 text-right font-semibold">₹{money(grandTotal)}</td>
              </tr>
              {subsidyValue > 0 && (
                <>
                  <tr>
                    <td className="border border-[#999] bg-[#f2f7f3] p-1 font-semibold">Est. Subsidy</td>
                    <td className="border border-[#999] p-1 text-right">− ₹{money(subsidyValue)}</td>
                  </tr>
                  <tr>
                    <td className="border border-[#999] bg-[#f2f7f3] p-1 font-semibold">Net Payable</td>
                    <td className="border border-[#999] p-1 text-right font-semibold">₹{money(netPayable)}</td>
                  </tr>
                </>
              )}
            </tbody>
          </table>

          <p className="border border-[#ccc] p-1 text-[10px]">
            <strong>Amount in Words: </strong>
            {amountInWords(grandTotal)}
          </p>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}

