"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { requireSuperAdmin } from "@/lib/permissions";
import { forSuperAdminUnscoped } from "@/lib/db";
import { DEFAULT_REQUIRED_DOCUMENT_TYPES } from "@/lib/requiredDocumentDefaults";
import type { BusinessType } from "@/generated/prisma/enums";

function randomTempPassword() {
  return Math.random().toString(36).slice(-10) + "A1!";
}

/**
 * Super Admin's tenant list is metadata + counts ONLY — never the tenant's
 * actual business rows (leads/inventory/finance). This is a confirmed
 * privacy boundary, not an oversight: do not add a drill-in view here.
 */
export async function listTenantsWithCounts() {
  await requireSuperAdmin();
  const db = forSuperAdminUnscoped();
  const tenants = await db.tenant.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { leads: true, connections: true, users: true } },
    },
  });
  return tenants;
}

export async function createTenant(input: {
  name: string;
  slug: string;
  businessType: BusinessType;
  adminName: string;
  adminEmail: string;
}) {
  await requireSuperAdmin();
  const db = forSuperAdminUnscoped();

  const tempPassword = randomTempPassword();
  const passwordHash = await bcrypt.hash(tempPassword, 10);

  const tenant = await db.tenant.create({
    data: {
      name: input.name,
      slug: input.slug,
      businessType: input.businessType,
      users: {
        create: {
          email: input.adminEmail,
          name: input.adminName,
          role: "ADMIN",
          passwordHash,
          mustChangePassword: true,
        },
      },
      requiredDocumentTypes: {
        create: DEFAULT_REQUIRED_DOCUMENT_TYPES.map((t, i) => ({ name: t.name, displayOrder: i })),
      },
    },
  });

  revalidatePath("/super-admin/tenants");
  // Temp password is only ever returned here, once, for the founder to
  // relay out-of-band (WhatsApp/email) — it is never stored in plaintext.
  return { tenant, tempPassword };
}

export async function setTenantActive(tenantId: string, isActive: boolean) {
  await requireSuperAdmin();
  const db = forSuperAdminUnscoped();
  await db.tenant.update({ where: { id: tenantId }, data: { isActive } });
  revalidatePath("/super-admin/tenants");
}
