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

export async function allocateToConnection(input: {
  inventoryItemId: string;
  connectionId: string;
  quantity: number;
}) {
  const { db, tenantId } = await getTenantDb();

  await db.$transaction(async (tx) => {
    const item = await tx.inventoryItem.findFirst({
      where: { id: input.inventoryItemId },
    });
    if (!item) throw new Error("Inventory item not found");
    if (Number(item.runningStock) < input.quantity) {
      throw new Error(
        `Not enough stock: ${item.runningStock} ${item.unit} available`,
      );
    }

    const connection = await tx.connection.findFirst({
      where: { id: input.connectionId },
    });
    if (!connection) throw new Error("Connection not found");

    // Weighted-average purchase cost snapshotted onto this allocation, so
    // per-connection profit never needs to walk purchase history at read
    // time (see src/server/finance.ts).
    const purchases = await tx.inventoryTransaction.findMany({
      where: { inventoryItemId: item.id, type: "PURCHASE" },
      select: { quantity: true, unitCost: true },
    });
    const totalPurchasedQty = purchases.reduce((sum, p) => sum + Number(p.quantity), 0);
    const totalPurchasedCost = purchases.reduce(
      (sum, p) => sum + Number(p.quantity) * Number(p.unitCost ?? 0),
      0,
    );
    const avgUnitCost = totalPurchasedQty > 0 ? totalPurchasedCost / totalPurchasedQty : 0;

    await tx.inventoryTransaction.create({
      data: {
        tenantId,
        inventoryItemId: item.id,
        connectionId: connection.id,
        type: "ALLOCATION",
        quantity: input.quantity,
        unitCost: avgUnitCost,
      },
    });

    await tx.inventoryItem.update({
      where: { id: item.id },
      data: { runningStock: { decrement: input.quantity } },
    });
  });

  revalidatePath("/admin/inventory");
  revalidatePath(`/admin/connections/${input.connectionId}`);
}
