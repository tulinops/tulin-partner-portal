import type { EquipmentType } from "@/generated/prisma/enums";
import type { EstimateLineItem } from "@/server/leads";
import type { InstalledEquipmentItem } from "@/server/connections";

// Single source of truth for the 9 EquipmentType values — used by both the
// Installed Equipment editor and the Warranty form's type select.
export const EQUIPMENT_TYPES = [
  "PANEL",
  "INVERTER",
  "MOUNTING_STRUCTURE",
  "DC_CABLE",
  "AC_CABLE",
  "EARTHING_KIT",
  "LIGHTNING_ARRESTOR",
  "NET_METER",
  "OTHER",
] as const;

// Best-effort match against the fixed descriptions buildBrandLineItems() and
// DEFAULT_ESTIMATE_ROWS produce, resilient to an admin's free-text edits.
export function guessEquipmentType(description: string): EquipmentType {
  const d = description.toLowerCase();
  if (d.includes("panel") || d.includes("pv module")) return "PANEL";
  if (d.includes("inverter")) return "INVERTER";
  if (d.includes("mounting") || d.includes("structure")) return "MOUNTING_STRUCTURE";
  if (d.includes("dc") && d.includes("cable")) return "DC_CABLE";
  if (d.includes("ac") && d.includes("cable")) return "AC_CABLE";
  if (d.includes("earth")) return "EARTHING_KIT";
  if (d.includes("lightning")) return "LIGHTNING_ARRESTOR";
  if (d.includes("net meter") || d.includes("netmeter")) return "NET_METER";
  return "OTHER";
}

// Pre-fills the Installation tab's equipment list from the approved
// quotation, so the installer isn't retyping panel/inverter/cable details
// that are already on file — they can still edit or remove any row, and add
// more for anything the site actually needed beyond what was quoted.
export function buildEquipmentFromEstimateLineItems(
  lineItems: EstimateLineItem[],
  brand?: string | null,
): InstalledEquipmentItem[] {
  const items: InstalledEquipmentItem[] = [];
  for (const li of lineItems) {
    const description = li.description.toLowerCase();
    if (!li.description.trim()) continue;
    // A service line, not a physical unit to serialize/warranty.
    if (description.includes("installation") && description.includes("commissioning")) continue;

    // One combined estimate line, two distinct EquipmentType values.
    if (description.includes("earth") && description.includes("lightning")) {
      items.push({ type: "EARTHING_KIT", brand: brand ?? undefined, model: li.spec, quantity: li.qty });
      items.push({ type: "LIGHTNING_ARRESTOR", brand: brand ?? undefined, model: li.spec, quantity: li.qty });
      continue;
    }

    items.push({
      type: guessEquipmentType(li.description),
      brand: brand ?? undefined,
      model: li.spec,
      quantity: li.qty,
    });
  }
  return items;
}

export const WARRANTY_TYPES = ["PRODUCT", "PERFORMANCE", "WORKMANSHIP"] as const;

export function defaultWarrantyProductName(item: { type: EquipmentType; brand?: string }) {
  return `${item.brand ? item.brand + " " : ""}${item.type.replace(/_/g, " ")}`;
}

// Only PANEL/INVERTER have an established default — same convention already
// used by recordInstallationSignOff's auto-warranty logic (25yr/8yr). No
// invented numbers for the other equipment types; the admin fills those in.
export function defaultPeriodMonths(type: EquipmentType) {
  if (type === "PANEL") return 300;
  if (type === "INVERTER") return 96;
  return undefined;
}

export function equipmentOptionLabel(item: { type: EquipmentType; brand?: string; serialNumber?: string }) {
  return `${item.type.replace(/_/g, " ")}${item.brand ? ` · ${item.brand}` : ""}${
    item.serialNumber ? ` · ${item.serialNumber}` : ""
  }`;
}
