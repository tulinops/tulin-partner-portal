"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import type { InvoiceLineItem } from "@/server/invoices";

function money(n: number) {
  return n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function InvoiceItemsEditor({
  initialItems,
  initialGstPercent,
}: {
  initialItems: InvoiceLineItem[];
  initialGstPercent: number;
}) {
  const [rows, setRows] = useState<InvoiceLineItem[]>(
    initialItems.length ? initialItems : [{ description: "", spec: "", qty: 1, rate: 0, amount: 0 }],
  );
  const [gstPercent, setGstPercent] = useState(String(initialGstPercent));

  function updateRow(i: number, field: keyof InvoiceLineItem, value: string) {
    setRows((prev) =>
      prev.map((r, idx) =>
        idx === i
          ? { ...r, [field]: field === "qty" || field === "rate" ? Number(value) || 0 : value }
          : r,
      ),
    );
  }

  function addRow() {
    setRows((prev) => [...prev, { description: "", spec: "", qty: 1, rate: 0, amount: 0 }]);
  }

  function removeRow(i: number) {
    setRows((prev) => prev.filter((_, idx) => idx !== i));
  }

  const visibleRows = rows.filter((r) => r.description.trim());
  const subtotal = visibleRows.reduce((sum, r) => sum + r.qty * r.rate, 0);
  const gstAmount = subtotal * ((parseFloat(gstPercent) || 0) / 100);
  const grandTotal = subtotal + gstAmount;

  return (
    <div className="space-y-4">
      {/* Rows can grow via "+ Add item" — tell the server exactly how many
          item_N_* fields to read instead of silently truncating. */}
      <input type="hidden" name="itemCount" value={rows.length} />

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
                    value={row.spec ?? ""}
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
      </div>

      <table className="ml-auto w-full max-w-xs border-collapse text-sm">
        <tbody>
          <tr>
            <td className="border p-1.5 text-muted-foreground">Subtotal</td>
            <td className="border p-1.5 text-right font-mono">₹{money(subtotal)}</td>
          </tr>
          <tr>
            <td className="border p-1.5 text-muted-foreground">GST ({gstPercent || 0}%)</td>
            <td className="border p-1.5 text-right font-mono">₹{money(gstAmount)}</td>
          </tr>
          <tr className="bg-muted font-semibold">
            <td className="border p-1.5">Grand total</td>
            <td className="border p-1.5 text-right font-mono">₹{money(grandTotal)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
