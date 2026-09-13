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

  // --- Estimate lifecycle (mirrors src/server/leads.ts createEstimate) ---
  const estimateLead = await db.lead.create({
    data: {
      tenantId: tenant.id,
      customerName: "Estimate Customer",
      phone: "888",
      email: "estimate.customer@example.com",
      requirementNotes: "3kW rooftop, wants lowest monthly bill",
      source: "INSTAGRAM",
    },
  });

  async function createEstimate(items: { description: string; qty: number; rate: number }[], gstPercent: number) {
    const lineItems = items.map((li) => ({ ...li, amount: li.qty * li.rate }));
    const subtotal = lineItems.reduce((s, li) => s + li.amount, 0);
    const gstAmount = subtotal * (gstPercent / 100);
    const totalAmount = subtotal + gstAmount;
    return db.$transaction(async (tx) => {
      const prior = await tx.estimate.count({ where: { leadId: estimateLead.id } });
      await tx.estimate.updateMany({ where: { leadId: estimateLead.id }, data: { isCurrent: false } });
      return tx.estimate.create({
        data: {
          tenantId: tenant.id,
          leadId: estimateLead.id,
          estimateNumber: `TEST/2026-2027/${Date.now()}-${prior}`,
          version: prior + 1,
          isCurrent: true,
          lineItems,
          subtotal,
          gstPercent,
          gstAmount,
          totalAmount,
          subsidyEstimate: 78000,
        },
      });
    });
  }

  const estimateV1 = await createEstimate([{ description: "Panel", qty: 6, rate: 10000 }], 5);
  assert(Number(estimateV1.subtotal) === 60000, `expected subtotal 60000, got ${estimateV1.subtotal}`);
  assert(Number(estimateV1.gstAmount) === 3000, `expected GST 3000, got ${estimateV1.gstAmount}`);
  assert(Number(estimateV1.totalAmount) === 63000, `expected total 63000, got ${estimateV1.totalAmount}`);
  assert(estimateV1.version === 1 && estimateV1.isCurrent, "expected v1 to be current");

  const estimateV2 = await createEstimate([{ description: "Panel", qty: 8, rate: 10000 }], 5);
  assert(estimateV2.version === 2, `expected v2, got version ${estimateV2.version}`);

  const v1Reloaded = await db.estimate.findFirst({ where: { id: estimateV1.id } });
  assert(v1Reloaded!.isCurrent === false, "expected v1 to flip isCurrent=false after v2 created");
  const v2Reloaded = await db.estimate.findFirst({ where: { id: estimateV2.id } });
  assert(v2Reloaded!.isCurrent === true, "expected v2 to be current");

  console.log("Estimate versioning checks passed (subtotal/GST/total calc, isCurrent flip).");

  // --- Post-Won pipeline: site inspection -> document verification -> subsidy -> warranty ---
  const pipelineConnection = await db.$transaction(async (tx) => {
    await tx.lead.update({ where: { id: estimateLead.id }, data: { stage: "WON" } });
    return tx.connection.create({
      data: {
        tenantId: tenant.id,
        leadId: estimateLead.id,
        customerName: "Estimate Customer",
        phone: "888",
        systemSizeKw: 3,
      },
    });
  });
  assert(
    pipelineConnection.status === "SITE_INSPECTION_PENDING",
    `expected default status SITE_INSPECTION_PENDING, got ${pipelineConnection.status}`,
  );

  // Mirrors updateSiteVisitStatus's "nudge status forward" convenience.
  await db.connection.update({
    where: { id: pipelineConnection.id },
    data: {
      siteVisitStatus: "COMPLETED",
      siteVisitResult: "SUITABLE",
      status: "SITE_INSPECTION_DONE",
    },
  });

  // Mirrors ensureConnectionDocuments + updateDocumentStatus's configurable checklist.
  const requiredDocType = await basePrisma.requiredDocumentType.create({
    data: { tenantId: tenant.id, name: "ID proof", displayOrder: 0 },
  });
  const connectionDoc = await basePrisma.connectionDocument.create({
    data: { tenantId: tenant.id, connectionId: pipelineConnection.id, requiredDocumentTypeId: requiredDocType.id },
  });
  await db.connectionDocument.update({ where: { id: connectionDoc.id }, data: { status: "VERIFIED" } });
  const allDocs = await db.connectionDocument.findMany({ where: { connectionId: pipelineConnection.id } });
  const documentsVerified = allDocs.length > 0 && allDocs.every((d) => d.status === "VERIFIED");
  assert(documentsVerified, "expected all required documents VERIFIED to compute documentsVerified=true");

  await db.connection.update({
    where: { id: pipelineConnection.id },
    data: { subsidyStatus: "APPLIED", subsidyAppliedAt: new Date(), status: "SUBSIDY_APPLIED" },
  });
  await db.connection.update({
    where: { id: pipelineConnection.id },
    data: { subsidyStatus: "APPROVED", subsidyApprovedAt: new Date(), status: "SUBSIDY_APPROVED" },
  });

  const afterSubsidy = await db.connection.findFirst({ where: { id: pipelineConnection.id } });
  assert(afterSubsidy!.status === "SUBSIDY_APPROVED", `expected status SUBSIDY_APPROVED, got ${afterSubsidy!.status}`);
  assert(afterSubsidy!.subsidyStatus === "APPROVED", "expected subsidyStatus APPROVED");

  await db.connection.update({
    where: { id: pipelineConnection.id },
    data: { status: "INSTALLATION_IN_PROGRESS" },
  });
  await db.connection.update({ where: { id: pipelineConnection.id }, data: { status: "COMPLETED" } });

  const warrantyStart = new Date("2026-01-01");
  const warranty = await db.warrantyRecord.create({
    data: {
      tenantId: tenant.id,
      connectionId: pipelineConnection.id,
      equipmentType: "PANEL",
      productName: "Solar Panels",
      startDate: warrantyStart,
      periodMonths: 120,
    },
  });
  const expiry = new Date(warranty.startDate);
  expiry.setMonth(expiry.getMonth() + warranty.periodMonths);
  assert(expiry.getFullYear() === 2036 && expiry.getMonth() === 0, `expected warranty expiry Jan 2036, got ${expiry}`);
  const afterWarranty = await db.connection.findFirst({ where: { id: pipelineConnection.id } });
  assert(afterWarranty!.status === "COMPLETED", "expected final status COMPLETED");

  console.log(
    "Post-Won pipeline checks passed (status nudges through inspection/subsidy, document checklist, warranty expiry calc).",
  );

  // Cleanup
  await basePrisma.customerPayment.deleteMany({ where: { tenantId: tenant.id } });
  await basePrisma.inventoryTransaction.deleteMany({ where: { tenantId: tenant.id } });
  await basePrisma.warrantyRecord.deleteMany({ where: { tenantId: tenant.id } });
  await basePrisma.connectionDocument.deleteMany({ where: { tenantId: tenant.id } });
  await basePrisma.requiredDocumentType.deleteMany({ where: { tenantId: tenant.id } });
  await basePrisma.loanApplication.deleteMany({ where: { tenantId: tenant.id } });
  await basePrisma.connection.deleteMany({ where: { tenantId: tenant.id } });
  await basePrisma.estimate.deleteMany({ where: { tenantId: tenant.id } });
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
