export const SOLAR_BRANDS = [
  { value: "WAAREE", label: "Waaree" },
  { value: "LUMINOUS", label: "Luminous" },
  { value: "MICROTEK", label: "Microtek" },
  { value: "RENEW", label: "ReNew" },
  { value: "VIKRAM", label: "Vikram" },
  { value: "ADANI", label: "Adani" },
] as const;

export type SolarBrandValue = (typeof SOLAR_BRANDS)[number]["value"];

export function brandLabel(value: string | null | undefined): string | null {
  return SOLAR_BRANDS.find((b) => b.value === value)?.label ?? null;
}

export type BrandLineItem = { description: string; spec: string; qty?: number; rate?: number };

// Line-for-line port of quotation.html's loadBrandItems() templates.
export function buildBrandLineItems(brandLabelText: string, capacityKw: number): BrandLineItem[] {
  return [
    {
      description: `${brandLabelText} Solar PV Module`,
      spec: `${capacityKw} kW Solar Panel System - Mono PERC / TOPCon`,
    },
    {
      description: "Solar Inverter",
      spec: `${capacityKw} kW ${brandLabelText} Compatible On-Grid Solar Inverter`,
    },
    { description: "Solar Mounting Structure", spec: "Hot Dip Galvanized / Aluminium Structure" },
    { description: "DC Solar Cable", spec: "UV Resistant DC Solar Cable" },
    { description: "AC Cable", spec: "Copper / Aluminium AC Cable" },
    { description: "MC4 Connectors", spec: "Original Compatible MC4 Connectors" },
    {
      description: "Earthing & Lightning Protection",
      spec: "Complete Earthing & Lightning Protection System",
    },
    {
      description: "Installation & Commissioning",
      spec: "Complete Solar System Installation & Commissioning",
    },
  ];
}
