"use server";

import { revalidatePath } from "next/cache";
import { getTenantDb } from "@/lib/tenantDb";
import { asActionResult } from "@/lib/actionResult";

// Active-only — used for operational pickers (e.g. site-visit assignment)
// where an inactive worker shouldn't be selectable.
export async function listStaffMembers() {
  const { db } = await getTenantDb();
  return db.staffMember.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
  });
}

// Unfiltered — used by the Staff admin page, which manages both active and
// inactive workers.
export async function listAllStaffMembers() {
  const { db } = await getTenantDb();
  return db.staffMember.findMany({
    orderBy: { name: "asc" },
  });
}

export async function createStaffMember(input: {
  name: string;
  phone?: string;
  designation?: string;
  address?: string;
}) {
  const { db, tenantId } = await getTenantDb();
  await db.staffMember.create({
    data: {
      tenantId,
      name: input.name,
      phone: input.phone,
      designation: input.designation,
      address: input.address,
    },
  });
  revalidatePath("/admin/staff");
}

export async function updateStaffMember(input: {
  id: string;
  name: string;
  phone?: string;
  designation?: string;
  address?: string;
  isActive: boolean;
}) {
  return asActionResult(async () => {
    const { db } = await getTenantDb();
    const staff = await db.staffMember.findFirst({ where: { id: input.id } });
    if (!staff) throw new Error("Worker not found");

    await db.staffMember.update({
      where: { id: input.id },
      data: {
        name: input.name,
        phone: input.phone,
        designation: input.designation,
        address: input.address,
        isActive: input.isActive,
      },
    });
    revalidatePath("/admin/staff");
  });
}
