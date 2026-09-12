"use server";

import { getTenantDb } from "@/lib/tenantDb";

export async function getDashboardTotals() {
  const { db } = await getTenantDb();

  const [leadsByStage, connectionsByStatus, inventoryItems, allTxns, payments] =
    await Promise.all([
      db.lead.groupBy({ by: ["stage"], _count: { _all: true } }),
      db.connection.groupBy({ by: ["status"], _count: { _all: true } }),
      db.inventoryItem.findMany({ select: { id: true, name: true, unit: true, runningStock: true } }),
      db.inventoryTransaction.findMany({ select: { type: true, quantity: true, unitCost: true } }),
      db.customerPayment.findMany({ select: { amount: true } }),
    ]);

  const totalInvested = allTxns
    .filter((t) => t.type === "PURCHASE")
    .reduce((sum, t) => sum + Number(t.quantity) * Number(t.unitCost ?? 0), 0);

  const totalAllocatedCost = allTxns
    .filter((t) => t.type === "ALLOCATION")
    .reduce((sum, t) => sum + Number(t.quantity) * Number(t.unitCost ?? 0), 0);

  const totalCollected = payments.reduce((sum, p) => sum + Number(p.amount), 0);
  const netProfit = totalCollected - totalAllocatedCost;

  return {
    leadsByStage: Object.fromEntries(leadsByStage.map((s) => [s.stage, s._count._all])),
    connectionsByStatus: Object.fromEntries(
      connectionsByStatus.map((s) => [s.status, s._count._all]),
    ),
    stockLevels: inventoryItems,
    totalInvested,
    totalCollected,
    netProfit,
  };
}
