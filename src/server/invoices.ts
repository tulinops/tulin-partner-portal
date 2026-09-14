"use server";

import { revalidatePath } from "next/cache";
import { getTenantDb } from "@/lib/tenantDb";
import { guessEquipmentType, defaultWarrantyProductName } from "@/lib/installationEquipment";
import { DEFAULT_ESTIMATE_TERMS } from "@/lib/estimateDefaults";
import type { EstimateLineItem } from "@/server/leads";
import type { InstalledEquipmentItem } from "@/server/connections";

export type InvoiceLineItem = {
  description: string;
  spec?: string;
  qty: number;
  rate: number;
  amount: number;
};

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
  return `${tenantSlug.toUpperCase()}/INV/${fiscalYear}/${stamp}`;
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
    const matchingQuoteRate = quoteLineItems.find((li) => guessEquipmentType(li.description) === item.type)?.rate ?? 0;
    const qty = item.quantity;
    const rate = matchingQuoteRate;
    return {
      description: defaultWarrantyProductName(item),
      spec: item.model,
      qty,
      rate,
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
  const equipment = (connection.installedEquipment ?? []) as InstalledEquipmentItem[];
  const items = buildInvoiceLineItems(equipment, quoteLineItems);

  const subtotal = items.reduce((sum, li) => sum + li.amount, 0);
  const gstPercent = finalEstimate ? Number(finalEstimate.gstPercent) : 0;
  const gstAmount = subtotal * (gstPercent / 100);
  const totalAmount = subtotal + gstAmount;

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

// Recomputes totals the same way generateInvoice does — the two must never
// drift, since an invoice can be edited freely after creation.
export async function updateInvoice(
  invoiceId: string,
  input: {
    lineItems: InvoiceLineItem[];
    gstPercent: number;
    invoiceDate?: Date;
    notes?: string;
  },
) {
  const { db } = await getTenantDb();
  const invoice = await db.invoice.findFirst({ where: { id: invoiceId } });
  if (!invoice) throw new Error("Invoice not found");

  const items = input.lineItems
    .filter((li) => li.description.trim().length > 0)
    .map((li) => ({ ...li, amount: li.qty * li.rate }));
  const subtotal = items.reduce((sum, li) => sum + li.amount, 0);
  const gstAmount = subtotal * (input.gstPercent / 100);
  const totalAmount = subtotal + gstAmount;

  await db.invoice.update({
    where: { id: invoiceId },
    data: {
      lineItems: items,
      subtotal,
      gstPercent: input.gstPercent,
      gstAmount,
      totalAmount,
      invoiceDate: input.invoiceDate,
      notes: input.notes,
    },
  });
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
