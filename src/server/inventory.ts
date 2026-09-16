"use server";

import { revalidatePath } from "next/cache";
import { getTenantDb } from "@/lib/tenantDb";

export async function listInventoryItems() {
  const { db } = await getTenantDb();
  return db.inventoryItem.findMany({
    orderBy: { name: "asc" },
    include: { transactions: { orderBy: { createdAt: "desc" } } },
  });
}

export async function createInventoryItem(input: {
  name: string;
  unit?: string;
  supplier?: string;
}) {
  const { db, tenantId } = await getTenantDb();
  await db.inventoryItem.create({
    data: { tenantId, name: input.name, unit: input.unit || "pcs", supplier: input.supplier },
  });
  revalidatePath("/admin/inventory");
}

export async function recordPurchase(input: {
  inventoryItemId: string;
  quantity: number;
  unitCost: number;
  supplier?: string;
  purchaseDate?: Date;
}) {
  const { db, tenantId } = await getTenantDb();

  await db.$transaction(async (tx) => {
    const item = await tx.inventoryItem.findFirst({
      where: { id: input.inventoryItemId },
    });
    if (!item) throw new Error("Inventory item not found");

    await tx.inventoryTransaction.create({
      data: {
        tenantId,
        inventoryItemId: item.id,
        type: "PURCHASE",
        quantity: input.quantity,
        unitCost: input.unitCost,
        supplier: input.supplier,
        purchaseDate: input.purchaseDate ?? new Date(),
      },
    });

    await tx.inventoryItem.update({
      where: { id: item.id },
      data: { runningStock: { increment: input.quantity } },
    });
  });

  revalidatePath("/admin/inventory");
}

// Manual "Allocate inventory" was replaced by auto-deduction at Installation
// sign-off (see recordInstallationSignOff in src/server/connections.ts),
// which now owns the weighted-average-cost + stock-decrement ALLOCATION
// transaction logic that used to live here.
