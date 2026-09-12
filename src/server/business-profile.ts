"use server";

import { revalidatePath } from "next/cache";
import { getTenantDb } from "@/lib/tenantDb";

// Tenant isn't a tenant-scoped model in the isolation extension (it IS the
// tenant), so these reads/writes are scoped manually by the session's own
// tenantId — never by a client-supplied id.

export async function getBusinessProfile() {
  const { db, tenantId } = await getTenantDb();
  return db.tenant.findFirst({ where: { id: tenantId } });
}

export async function updateBusinessProfile(input: {
  businessAddress?: string;
  gstin?: string;
  contactPhone?: string;
  contactEmail?: string;
}) {
  const { db, tenantId } = await getTenantDb();
  await db.tenant.update({
    where: { id: tenantId },
    data: {
      businessAddress: input.businessAddress,
      gstin: input.gstin,
      contactPhone: input.contactPhone,
      contactEmail: input.contactEmail,
    },
  });
  revalidatePath("/admin/settings");
}
