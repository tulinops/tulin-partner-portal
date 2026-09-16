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
  brand?: string;
  unit?: string;
  supplier?: string;
}) {
  const { db, tenantId } = await getTenantDb();
  await db.inventoryItem.create({
    data: {
      tenantId,
      name: input.name,
      brand: input.brand,
      unit: input.unit || "pcs",
      supplier: input.supplier,
    },
  });
  revalidatePath("/admin/inventory");
}

// Metadata only — runningStock is a derived ledger balance (see
// recordPurchase / recordInstallationSignOff's auto-deduction), never
// edited directly here, so it can't drift from its PURCHASE/ALLOCATION
// transaction history.
export async function updateInventoryItem(input: {
  id: string;
  name: string;
  brand?: string;
  unit: string;
  supplier?: string;
}) {
  const { db } = await getTenantDb();
  const item = await db.inventoryItem.findFirst({ where: { id: input.id } });
  if (!item) throw new Error("Inventory item not found");

  await db.inventoryItem.update({
    where: { id: input.id },
    data: { name: input.name, brand: input.brand, unit: input.unit || "pcs", supplier: input.supplier },
  });
  revalidatePath("/admin/inventory");
}

export async function deleteInventoryItem(id: string) {
  const { db } = await getTenantDb();
  const item = await db.inventoryItem.findFirst({ where: { id } });
  if (!item) throw new Error("Inventory item not found");

  const txnCount = await db.inventoryTransaction.count({ where: { inventoryItemId: id } });
  if (txnCount > 0) {
    throw new Error(`Cannot delete — this item has ${txnCount} purchase/allocation record(s) on file.`);
  }

  await db.inventoryItem.delete({ where: { id } });
  revalidatePath("/admin/inventory");
}

export async function recordPurchase(input: {
  inventoryItemId: string;
  quantity: number;
  unitCost: number;
  supplier?: string;
  brand?: string;
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
        // Falls back to the item's own brand so a purchase's brand is
        // rarely blank — only override this when the batch actually came
        // from a different brand than the item's default.
        brand: input.brand || item.brand || undefined,
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
