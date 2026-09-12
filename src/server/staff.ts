"use server";

import { revalidatePath } from "next/cache";
import { getTenantDb } from "@/lib/tenantDb";

export async function listStaffMembers() {
  const { db } = await getTenantDb();
  return db.staffMember.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
  });
}

export async function createStaffMember(input: { name: string; phone?: string }) {
  const { db, tenantId } = await getTenantDb();
  await db.staffMember.create({
    data: {
      tenantId,
      name: input.name,
      phone: input.phone,
    },
  });
  revalidatePath("/admin/staff");
}
