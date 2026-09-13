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
  const tenantA = await basePrisma.tenant.create({
    data: { name: "Verify Tenant A", slug: `verify-a-${Date.now()}`, businessType: "SOLAR" },
  });
  const tenantB = await basePrisma.tenant.create({
    data: { name: "Verify Tenant B", slug: `verify-b-${Date.now()}`, businessType: "SOLAR" },
  });

  const dbA = forTenant(tenantA.id);
  const dbB = forTenant(tenantB.id);

  const leadA = await dbA.lead.create({
    data: { tenantId: tenantA.id, customerName: "A's customer", phone: "111", source: "OTHER" },
  });
  await dbB.lead.create({
    data: { tenantId: tenantB.id, customerName: "B's customer", phone: "222", source: "OTHER" },
  });

  // 1. A tenant-scoped client with NO explicit where-filter must still only
  // see its own tenant's rows (this is the core fail-closed guarantee).
  const leadsSeenByA = await dbA.lead.findMany({});
  assert(leadsSeenByA.length === 1, `expected A to see 1 lead, saw ${leadsSeenByA.length}`);
  assert(leadsSeenByA[0].customerName === "A's customer", "A saw the wrong lead");

  const leadsSeenByB = await dbB.lead.findMany({});
  assert(leadsSeenByB.length === 1, `expected B to see 1 lead, saw ${leadsSeenByB.length}`);

  // 2. Tenant B must not be able to fetch tenant A's lead by id.
  const crossTenantFetch = await dbB.lead.findFirst({ where: { id: leadA.id } });
  assert(crossTenantFetch === null, "tenant B could read tenant A's lead by id — ISOLATION BROKEN");

  // 3. Interactive $transaction must preserve the extension's tenant scoping
  // (this was flagged as a real risk in the plan, not assumed).
  const convertedConnection = await dbA.$transaction(async (tx) => {
    await tx.lead.update({ where: { id: leadA.id }, data: { stage: "WON" } });
    return tx.connection.create({
      data: {
        tenantId: tenantA.id,
        leadId: leadA.id,
        customerName: "A's customer",
        phone: "111",
      },
    });
  });
  assert(convertedConnection.tenantId === tenantA.id, "connection created without correct tenantId");

  const bSeesAConnection = await dbB.connection.findFirst({ where: { id: convertedConnection.id } });
  assert(bSeesAConnection === null, "tenant B could read tenant A's connection — ISOLATION BROKEN");

  // 4. Estimate model (added for the estimate/inspection/subsidy pipeline)
  // must be tenant-scoped too — it's easy to forget to add a new model to
  // TENANT_SCOPED_MODELS, so this is a direct regression check for that.
  const estimateA = await dbA.estimate.create({
    data: {
      tenantId: tenantA.id,
      leadId: leadA.id,
      estimateNumber: `ISO-TEST/${Date.now()}`,
      lineItems: [{ description: "Panel", qty: 1, rate: 100, amount: 100 }],
      subtotal: 100,
      totalAmount: 100,
    },
  });

  const bSeesAEstimate = await dbB.estimate.findFirst({ where: { id: estimateA.id } });
  assert(bSeesAEstimate === null, "tenant B could read tenant A's estimate — ISOLATION BROKEN");

  const estimatesSeenByA = await dbA.estimate.findMany({});
  assert(estimatesSeenByA.length === 1, `expected A to see 1 estimate, saw ${estimatesSeenByA.length}`);

  // 5. SitePhoto model (added for the site-visit stage) must be tenant-scoped
  // too — same regression risk as Estimate above.
  const photoA = await dbA.sitePhoto.create({
    data: {
      tenantId: tenantA.id,
      connectionId: convertedConnection.id,
      category: "ROOF",
      filePath: `uploads/${tenantA.id}/${convertedConnection.id}/test.jpg`,
      originalName: "test.jpg",
    },
  });
  const bSeesAPhoto = await dbB.sitePhoto.findFirst({ where: { id: photoA.id } });
  assert(bSeesAPhoto === null, "tenant B could read tenant A's site photo — ISOLATION BROKEN");

  // 6. RequiredDocumentType, ConnectionDocument, LoanApplication, and
  // WarrantyRecord (added for the Documents/Subsidy-Loan/Installation/
  // Warranty stages) must all be tenant-scoped too — same regression risk.
  const docTypeA = await dbA.requiredDocumentType.create({
    data: { tenantId: tenantA.id, name: "ID proof" },
  });
  const bSeesADocType = await dbB.requiredDocumentType.findFirst({ where: { id: docTypeA.id } });
  assert(bSeesADocType === null, "tenant B could read tenant A's required document type — ISOLATION BROKEN");

  const connectionDocA = await dbA.connectionDocument.create({
    data: { tenantId: tenantA.id, connectionId: convertedConnection.id, requiredDocumentTypeId: docTypeA.id },
  });
  const bSeesAConnectionDoc = await dbB.connectionDocument.findFirst({ where: { id: connectionDocA.id } });
  assert(bSeesAConnectionDoc === null, "tenant B could read tenant A's connection document — ISOLATION BROKEN");

  const loanA = await dbA.loanApplication.create({
    data: { tenantId: tenantA.id, connectionId: convertedConnection.id, bankName: "Test Bank", loanAmount: 100 },
  });
  const bSeesALoan = await dbB.loanApplication.findFirst({ where: { id: loanA.id } });
  assert(bSeesALoan === null, "tenant B could read tenant A's loan application — ISOLATION BROKEN");

  const warrantyA = await dbA.warrantyRecord.create({
    data: {
      tenantId: tenantA.id,
      connectionId: convertedConnection.id,
      equipmentType: "PANEL",
      productName: "Test Panel",
      startDate: new Date(),
      periodMonths: 12,
    },
  });
  const bSeesAWarranty = await dbB.warrantyRecord.findFirst({ where: { id: warrantyA.id } });
  assert(bSeesAWarranty === null, "tenant B could read tenant A's warranty record — ISOLATION BROKEN");

  console.log("All tenant isolation checks passed.");

  // Clean up in dependency order so this script is safe to re-run against a
  // shared dev database without leaving orphan test tenants behind.
  for (const tenantId of [tenantA.id, tenantB.id]) {
    await basePrisma.sitePhoto.deleteMany({ where: { tenantId } });
    await basePrisma.warrantyRecord.deleteMany({ where: { tenantId } });
    await basePrisma.connectionDocument.deleteMany({ where: { tenantId } });
    await basePrisma.requiredDocumentType.deleteMany({ where: { tenantId } });
    await basePrisma.loanApplication.deleteMany({ where: { tenantId } });
    await basePrisma.connection.deleteMany({ where: { tenantId } });
    await basePrisma.estimate.deleteMany({ where: { tenantId } });
    await basePrisma.lead.deleteMany({ where: { tenantId } });
    await basePrisma.tenant.delete({ where: { id: tenantId } });
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await basePrisma.$disconnect();
  });
