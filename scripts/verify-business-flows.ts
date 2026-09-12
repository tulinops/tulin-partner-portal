import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { forTenant } from "../src/lib/db";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const basePrisma = new PrismaClient({ adapter });

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`FAILED: ${message}`);
}

async function main() {
  const tenant = await basePrisma.tenant.create({
    data: { name: "Flow Test Co", slug: `flow-test-${Date.now()}`, businessType: "SOLAR" },
  });
  const db = forTenant(tenant.id);

  // --- Lead -> Connection ---
  const lead = await db.lead.create({
    data: { tenantId: tenant.id, customerName: "Flow Customer", phone: "999", source: "REFERRAL" },
  });
  const connection = await db.$transaction(async (tx) => {
    await tx.lead.update({ where: { id: lead.id }, data: { stage: "WON" } });
    return tx.connection.create({
      data: { tenantId: tenant.id, leadId: lead.id, customerName: "Flow Customer", phone: "999" },
    });
  });

  // --- Inventory: two purchases at different unit costs (weighted average) ---
  const item = await db.inventoryItem.create({
    data: { tenantId: tenant.id, name: "Test Panel", unit: "pcs" },
  });

  // Mirrors src/server/inventory.ts recordPurchase
  async function recordPurchase(quantity: number, unitCost: number) {
    await db.$transaction(async (tx) => {
      await tx.inventoryTransaction.create({
        data: { tenantId: tenant.id, inventoryItemId: item.id, type: "PURCHASE", quantity, unitCost },
      });
      await tx.inventoryItem.update({
        where: { id: item.id },
        data: { runningStock: { increment: quantity } },
      });
    });
  }

  await recordPurchase(10, 8000); // 10 @ 8000
  await recordPurchase(10, 9000); // 10 @ 9000 -> weighted avg = (10*8000+10*9000)/20 = 8500

  const afterPurchases = await db.inventoryItem.findFirst({ where: { id: item.id } });
  assert(Number(afterPurchases!.runningStock) === 20, `expected stock 20, got ${afterPurchases!.runningStock}`);

  // Mirrors src/server/inventory.ts allocateToConnection
  async function allocate(quantity: number) {
    return db.$transaction(async (tx) => {
      const purchases = await tx.inventoryTransaction.findMany({
        where: { inventoryItemId: item.id, type: "PURCHASE" },
        select: { quantity: true, unitCost: true },
      });
      const totalQty = purchases.reduce((s, p) => s + Number(p.quantity), 0);
      const totalCost = purchases.reduce((s, p) => s + Number(p.quantity) * Number(p.unitCost ?? 0), 0);
      const avgUnitCost = totalQty > 0 ? totalCost / totalQty : 0;

      const txn = await tx.inventoryTransaction.create({
        data: {
          tenantId: tenant.id,
          inventoryItemId: item.id,
          connectionId: connection.id,
          type: "ALLOCATION",
          quantity,
          unitCost: avgUnitCost,
        },
      });
      await tx.inventoryItem.update({
        where: { id: item.id },
        data: { runningStock: { decrement: quantity } },
      });
      return txn;
    });
  }

  const allocation = await allocate(5);
  assert(Number(allocation.unitCost) === 8500, `expected avg unit cost 8500, got ${allocation.unitCost}`);

  const afterAllocation = await db.inventoryItem.findFirst({ where: { id: item.id } });
  assert(Number(afterAllocation!.runningStock) === 15, `expected stock 15, got ${afterAllocation!.runningStock}`);

  // --- Payment + profit calc (mirrors src/server/connections.ts getConnectionDetail) ---
  await db.customerPayment.create({
    data: { tenantId: tenant.id, connectionId: connection.id, amount: 60000 },
  });

  const full = await db.connection.findFirst({
    where: { id: connection.id },
    include: { payments: true, inventoryTxns: true },
  });
  const collected = full!.payments.reduce((s, p) => s + Number(p.amount), 0);
  const allocatedCost = full!.inventoryTxns
    .filter((t) => t.type === "ALLOCATION")
    .reduce((s, t) => s + Number(t.quantity) * Number(t.unitCost ?? 0), 0);
  const profit = collected - allocatedCost;

  assert(collected === 60000, `expected collected 60000, got ${collected}`);
  assert(allocatedCost === 5 * 8500, `expected allocated cost 42500, got ${allocatedCost}`);
  assert(profit === 60000 - 42500, `expected profit 17500, got ${profit}`);

  console.log("All business flow checks passed (lead->connection, weighted-avg cost, allocation, payment, profit).");

  // Cleanup
  await basePrisma.customerPayment.deleteMany({ where: { tenantId: tenant.id } });
  await basePrisma.inventoryTransaction.deleteMany({ where: { tenantId: tenant.id } });
  await basePrisma.connection.deleteMany({ where: { tenantId: tenant.id } });
  await basePrisma.lead.deleteMany({ where: { tenantId: tenant.id } });
  await basePrisma.inventoryItem.deleteMany({ where: { tenantId: tenant.id } });
  await basePrisma.tenant.delete({ where: { id: tenant.id } });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await basePrisma.$disconnect();
  });
