// GST is set per line item (different components can carry different GST
// slabs in practice) rather than once for the whole estimate — the
// estimate-level gstPercent column now stores the blended/effective rate
// derived from these, purely for display and for older estimates saved
// before this field existed (see the ?? fallback where line items render).
export const DEFAULT_ITEM_GST_PERCENT = 5;

export type EstimateBuilderRow = {
  description: string;
  spec: string;
  brand?: string;
  qty: number;
  rate: number;
  gstPercent: number;
};

// Plain data, deliberately NOT in estimate-builder-with-preview.tsx (a "use
// client" file) — a server action importing a data export from a client
// module gets a client-reference wrapper instead of the real value at
// runtime, not the array itself, so .map() on it throws.
export const DEFAULT_ESTIMATE_ROWS: EstimateBuilderRow[] = [
  { description: "Solar PV Module", spec: "", qty: 1, rate: 0, gstPercent: DEFAULT_ITEM_GST_PERCENT },
  { description: "Solar Inverter", spec: "", qty: 1, rate: 0, gstPercent: DEFAULT_ITEM_GST_PERCENT },
  { description: "Solar Mounting Structure", spec: "Hot Dip Galvanized / Aluminium Structure", qty: 1, rate: 0, gstPercent: DEFAULT_ITEM_GST_PERCENT },
  { description: "DC Solar Cable", spec: "UV Resistant DC Solar Cable", qty: 1, rate: 0, gstPercent: DEFAULT_ITEM_GST_PERCENT },
  { description: "AC Cable", spec: "Copper / Aluminium AC Cable", qty: 1, rate: 0, gstPercent: DEFAULT_ITEM_GST_PERCENT },
  { description: "MC4 Connectors", spec: "Original Compatible MC4 Connectors", qty: 4, rate: 0, gstPercent: DEFAULT_ITEM_GST_PERCENT },
  { description: "Earthing & Lightning Protection", spec: "Complete Earthing & Lightning Protection System", qty: 1, rate: 0, gstPercent: DEFAULT_ITEM_GST_PERCENT },
  { description: "Installation & Commissioning", spec: "Complete Solar System Installation & Commissioning", qty: 1, rate: 0, gstPercent: DEFAULT_ITEM_GST_PERCENT },
];

// Shared between the create-estimate form (as defaultValue) and the print
// page (as a fallback for older estimates saved before this constant
// existed) so the two are never out of sync with each other.
export const DEFAULT_ESTIMATE_TERMS = `1. Prices are subject to the specifications mentioned in this estimate.
2. Material quantity may vary as per site conditions.
3. Installation and commissioning shall be carried out as agreed with the customer.
4. Payment terms shall be mutually agreed between the customer and the installer.
5. Estimate validity: as stated above from the date of issue.
6. Warranty will be as per the respective manufacturer's / installer's standard warranty terms.
7. Any additional work or material not mentioned in this estimate will be charged separately.
8. Final government subsidy amount is subject to scheme eligibility and approval; the figure above is indicative only.`;
