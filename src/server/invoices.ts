"use server";

import { revalidatePath } from "next/cache";
import { getTenantDb } from "@/lib/tenantDb";
import {
  guessEquipmentType,
  defaultWarrantyProductName,
  buildEquipmentFromEstimateLineItems,
} from "@/lib/installationEquipment";
import { brandLabel } from "@/lib/estimateBrands";
import { DEFAULT_ESTIMATE_TERMS, DEFAULT_ITEM_GST_PERCENT } from "@/lib/estimateDefaults";
import type { EstimateLineItem } from "@/server/leads";
import type { InstalledEquipmentItem } from "@/server/connections";

export type InvoiceLineItem = {
  description: string;
  spec?: string;
  brand?: string;
  qty: number;
  rate: number;
  amount: number;
  // Per-item GST, same rationale as Estimate.lineItems — see EstimateLineItem.
  gstPercent: number;
};

function computeInvoiceTotals(items: InvoiceLineItem[]) {
  const subtotal = items.reduce((sum, li) => sum + li.amount, 0);
  const gstAmount = items.reduce((sum, li) => sum + li.amount * ((li.gstPercent || 0) / 100), 0);
  const totalAmount = subtotal + gstAmount;
  // Invoice.gstPercent is the blended/effective rate derived from the line
  // items — kept for display and as a fallback for older invoices/items
  // saved before this field existed. Same pattern as Estimate.gstPercent.
  const gstPercent = subtotal > 0 ? (gstAmount / subtotal) * 100 : 0;
  return { subtotal, gstAmount, totalAmount, gstPercent };
}

async function generateInvoiceNumber(tenantSlug: string) {
  const now = new Date();
  const fiscalStartYear = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  const fiscalYear = `${fiscalStartYear}-${fiscalStartYear + 1}`;
  const stamp =
    now.getFullYear().toString() +
    String(now.getMonth() + 1).padStart(2, "0") +
    String(now.getDate()).padStart(2, "0") +
    String(now.getHours()).padStart(2, "0") +
    String(now.getMinutes()).padStart(2, "0") +
    String(now.getSeconds()).padStart(2, "0");
  // Same collision risk as generateEstimateNumber (src/server/leads.ts) — the
  // stamp is only second-granular against a globally-unique field.
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${tenantSlug.toUpperCase()}/INV/${fiscalYear}/${stamp}${suffix}`;
}

// Line items are seeded from what was actually installed, not the original
// quotation — on-site extras beyond what was quoted are common, and the
// invoice needs to bill for what really went in. Rate is carried over from
// the matching quotation line item (matched by equipment type) where one
// exists, left at 0 otherwise so the admin fills it in for anything added
// on-site that was never priced.
function buildInvoiceLineItems(
  equipment: InstalledEquipmentItem[],
  quoteLineItems: EstimateLineItem[],
): InvoiceLineItem[] {
  return equipment.map((item) => {
    const matchingQuoteItem = quoteLineItems.find((li) => guessEquipmentType(li.description) === item.type);
    const qty = item.quantity;
    const rate = matchingQuoteItem?.rate ?? 0;
    return {
      description: defaultWarrantyProductName(item),
      spec: item.model,
      brand: item.brand,
      qty,
      rate,
      gstPercent: matchingQuoteItem?.gstPercent ?? DEFAULT_ITEM_GST_PERCENT,
      amount: qty * rate,
    };
  });
}

export async function generateInvoice(connectionId: string) {
  const { db, tenantId } = await getTenantDb();
  const connection = await db.connection.findFirst({
    where: { id: connectionId },
    include: { invoice: true, lead: { include: { estimates: { where: { isCurrent: true }, take: 1 } } } },
  });
  if (!connection) throw new Error("Connection not found");
  if (connection.invoice) return connection.invoice.id;

  const tenant = await db.tenant.findFirst({ where: { id: tenantId } });
  if (!tenant) throw new Error("Tenant not found");

  const finalEstimate = connection.lead.estimates[0];
  const quoteLineItems = (finalEstimate?.lineItems as unknown as EstimateLineItem[] | null) ?? [];
  // The Installed Equipment form on the Installation tab shows the estimate's
  // items as an unsaved prefill until an admin explicitly clicks Save there
  // — so installedEquipment can still be null/empty for a connection whose
  // estimate is fully specified. Fall back to deriving equipment from the
  // estimate the same way that prefill does, so the invoice isn't seeded
  // empty just because nobody happened to save that form first.
  const savedEquipment = (connection.installedEquipment ?? []) as InstalledEquipmentItem[];
  const equipment =
    savedEquipment.length > 0
      ? savedEquipment
      : buildEquipmentFromEstimateLineItems(quoteLineItems, brandLabel(finalEstimate?.brand));
  const items = buildInvoiceLineItems(equipment, quoteLineItems);
  const { subtotal, gstAmount, totalAmount, gstPercent } = computeInvoiceTotals(items);

  const invoice = await db.invoice.create({
    data: {
      tenantId,
      connectionId,
      invoiceNumber: await generateInvoiceNumber(tenant.slug),
      lineItems: items,
      subtotal,
      gstPercent,
      gstAmount,
      totalAmount,
      notes: finalEstimate?.notes ?? DEFAULT_ESTIMATE_TERMS,
    },
  });
  revalidatePath(`/admin/connections/${connectionId}`);
  return invoice.id;
}

function assertInvoiceEditable(invoice: { status: string }) {
  if (invoice.status === "COMPLETE") {
    throw new Error("This invoice is complete and can no longer be edited");
  }
}

// Recomputes totals the same way generateInvoice does — the two must never
// drift, since an invoice can be edited freely until marked complete.
export async function updateInvoice(
  invoiceId: string,
  input: {
    lineItems: InvoiceLineItem[];
    invoiceDate?: Date;
    notes?: string;
  },
) {
  const { db } = await getTenantDb();
  const invoice = await db.invoice.findFirst({ where: { id: invoiceId } });
  if (!invoice) throw new Error("Invoice not found");
  assertInvoiceEditable(invoice);

  const items = input.lineItems
    .filter((li) => li.description.trim().length > 0)
    .map((li) => ({ ...li, amount: li.qty * li.rate, gstPercent: li.gstPercent || 0 }));
  const { subtotal, gstAmount, totalAmount, gstPercent } = computeInvoiceTotals(items);

  await db.invoice.update({
    where: { id: invoiceId },
    data: {
      lineItems: items,
      subtotal,
      gstPercent,
      gstAmount,
      totalAmount,
      invoiceDate: input.invoiceDate,
      notes: input.notes,
    },
  });
  revalidatePath(`/admin/connections/${invoice.connectionId}`);
  revalidatePath(`/admin/invoices/${invoiceId}`);
}

export async function completeInvoice(invoiceId: string) {
  const { db } = await getTenantDb();
  const invoice = await db.invoice.findFirst({ where: { id: invoiceId } });
  if (!invoice) throw new Error("Invoice not found");
  assertInvoiceEditable(invoice);

  await db.invoice.update({ where: { id: invoiceId }, data: { status: "COMPLETE" } });
  revalidatePath(`/admin/connections/${invoice.connectionId}`);
  revalidatePath(`/admin/invoices/${invoiceId}`);
}

export async function getInvoice(invoiceId: string) {
  const { db } = await getTenantDb();
  return db.invoice.findFirst({
    where: { id: invoiceId },
    include: { tenant: true, connection: { include: { lead: true } } },
  });
}
