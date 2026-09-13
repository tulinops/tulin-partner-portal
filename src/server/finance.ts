"use server";

import { getTenantDb } from "@/lib/tenantDb";

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export type ActivityItem = {
  kind: "lead" | "estimate" | "connection";
  headline: string;
  detail: string;
  at: Date;
};

export async function getDashboardTotals() {
  const { db } = await getTenantDb();
  const since30d = new Date(Date.now() - THIRTY_DAYS_MS);

  const [
    leadsByStage,
    connectionsByStatus,
    inventoryItems,
    allTxns,
    payments,
    newLeadsLast30Days,
    recentLeads,
    recentEstimates,
    recentConnections,
  ] = await Promise.all([
    db.lead.groupBy({ by: ["stage"], _count: { _all: true } }),
    db.connection.groupBy({ by: ["status"], _count: { _all: true } }),
    db.inventoryItem.findMany({ select: { id: true, name: true, unit: true, runningStock: true } }),
    db.inventoryTransaction.findMany({ select: { type: true, quantity: true, unitCost: true } }),
    db.customerPayment.findMany({ select: { amount: true } }),
    db.lead.count({ where: { createdAt: { gte: since30d } } }),
    db.lead.findMany({ orderBy: { createdAt: "desc" }, take: 5, select: { customerName: true, createdAt: true } }),
    db.estimate.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { totalAmount: true, createdAt: true, lead: { select: { customerName: true } } },
    }),
    db.connection.findMany({
      orderBy: { updatedAt: "desc" },
      take: 5,
      select: { customerName: true, status: true, updatedAt: true },
    }),
  ]);

  const totalInvested = allTxns
    .filter((t) => t.type === "PURCHASE")
    .reduce((sum, t) => sum + Number(t.quantity) * Number(t.unitCost ?? 0), 0);

  const totalAllocatedCost = allTxns
    .filter((t) => t.type === "ALLOCATION")
    .reduce((sum, t) => sum + Number(t.quantity) * Number(t.unitCost ?? 0), 0);

  const totalCollected = payments.reduce((sum, p) => sum + Number(p.amount), 0);
  const netProfit = totalCollected - totalAllocatedCost;

  const connectionStatusCounts = Object.fromEntries(
    connectionsByStatus.map((s) => [s.status, s._count._all]),
  );
  const activeConnections =
    connectionsByStatus.reduce((sum, s) => sum + s._count._all, 0) -
    (connectionStatusCounts["CANCELLED"] ?? 0) -
    (connectionStatusCounts["COMPLETED"] ?? 0);

  const activity: ActivityItem[] = [
    ...recentLeads.map((l) => ({
      kind: "lead" as const,
      headline: "New lead added",
      detail: l.customerName,
      at: l.createdAt,
    })),
    ...recentEstimates.map((e) => ({
      kind: "estimate" as const,
      headline: "Estimate created",
      detail: `${e.lead.customerName} · ₹${Number(e.totalAmount).toLocaleString("en-IN")}`,
      at: e.createdAt,
    })),
    ...recentConnections.map((c) => ({
      kind: "connection" as const,
      headline: `Connection updated — ${c.status.replaceAll("_", " ")}`,
      detail: c.customerName,
      at: c.updatedAt,
    })),
  ]
    .sort((a, b) => b.at.getTime() - a.at.getTime())
    .slice(0, 6);

  return {
    leadsByStage: Object.fromEntries(leadsByStage.map((s) => [s.stage, s._count._all])),
    connectionsByStatus: connectionStatusCounts,
    stockLevels: inventoryItems,
    totalInvested,
    totalCollected,
    netProfit,
    newLeadsLast30Days,
    activeConnections,
    activity,
  };
}
