import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { DEFAULT_REQUIRED_DOCUMENT_TYPES } from "../src/lib/requiredDocumentDefaults";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

function randomPassword() {
  return Math.random().toString(36).slice(-10) + "A1!";
}

async function main() {
  // Both accounts are upserted with `update: {}` — re-running this script
  // must never silently regenerate/print a password for a user that already
  // exists, since that print would be a lie (the upsert's `update: {}` never
  // actually touches passwordHash, so the DB keeps whatever hash it already
  // had). Only generate and print a password when actually creating the row.
  const superAdminEmail = "tulin.ops@gmail.com";
  const existingSuperAdmin = await prisma.user.findUnique({ where: { email: superAdminEmail } });
  const superAdminPassword = existingSuperAdmin ? null : randomPassword();

  await prisma.user.upsert({
    where: { email: superAdminEmail },
    update: {},
    create: {
      email: superAdminEmail,
      name: "Tulin Super Admin",
      role: "SUPER_ADMIN",
      passwordHash: await bcrypt.hash(superAdminPassword ?? randomPassword(), 10),
      mustChangePassword: false,
    },
  });

  const demoAdminEmail = "admin@demo-solar.test";
  const existingDemoAdmin = await prisma.user.findUnique({ where: { email: demoAdminEmail } });
  const demoAdminPassword = existingDemoAdmin ? null : randomPassword();

  const tenant = await prisma.tenant.upsert({
    where: { slug: "demo-solar" },
    update: {},
    create: {
      name: "Demo Solar Co",
      slug: "demo-solar",
      businessType: "SOLAR",
      users: {
        create: {
          email: demoAdminEmail,
          name: "Demo Proprietor",
          role: "ADMIN",
          passwordHash: await bcrypt.hash(demoAdminPassword ?? randomPassword(), 10),
          mustChangePassword: false,
        },
      },
    },
  });

  const existingDocTypes = await prisma.requiredDocumentType.count({ where: { tenantId: tenant.id } });
  if (existingDocTypes === 0) {
    await prisma.requiredDocumentType.createMany({
      data: DEFAULT_REQUIRED_DOCUMENT_TYPES.map((t, i) => ({ tenantId: tenant.id, name: t.name, displayOrder: i })),
    });
  }

  const existingLeads = await prisma.lead.count({ where: { tenantId: tenant.id } });
  if (existingLeads === 0) {
    await prisma.lead.createMany({
      data: [
        {
          tenantId: tenant.id,
          customerName: "Anita Rao",
          phone: "9876500001",
          source: "INSTAGRAM",
          stage: "SITE_VISIT",
          estimatedValue: 180000,
        },
        {
          tenantId: tenant.id,
          customerName: "Suresh Kumar",
          phone: "9876500002",
          source: "WHATSAPP",
          stage: "NEW",
          estimatedValue: 220000,
        },
      ],
    });

    const item = await prisma.inventoryItem.create({
      data: { tenantId: tenant.id, name: "540W Mono Panel", unit: "pcs", supplier: "SunFactory Ltd" },
    });
    await prisma.inventoryTransaction.create({
      data: {
        tenantId: tenant.id,
        inventoryItemId: item.id,
        type: "PURCHASE",
        quantity: 40,
        unitCost: 8000,
      },
    });
    await prisma.inventoryItem.update({
      where: { id: item.id },
      data: { runningStock: { increment: 40 } },
    });
  }

  const existingStaff = await prisma.staffMember.count({ where: { tenantId: tenant.id } });
  if (existingStaff === 0) {
    await prisma.staffMember.createMany({
      data: [
        { tenantId: tenant.id, name: "Ramu Chowdary", phone: "9876511001" },
        { tenantId: tenant.id, name: "Suresh Naidu", phone: "9876511002" },
      ],
    });
  }

  console.log("Seed complete.");
  console.log(
    superAdminPassword
      ? `Super Admin login: ${superAdminEmail} / ${superAdminPassword}`
      : `Super Admin ${superAdminEmail} already exists — password unchanged.`,
  );
  console.log(
    demoAdminPassword
      ? `Demo tenant Admin login: ${demoAdminEmail} / ${demoAdminPassword}`
      : `Demo tenant Admin ${demoAdminEmail} already exists — password unchanged.`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
