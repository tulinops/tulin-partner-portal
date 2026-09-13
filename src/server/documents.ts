"use server";

import { revalidatePath } from "next/cache";
import { getTenantDb } from "@/lib/tenantDb";
import type { DocumentStatus } from "@/generated/prisma/enums";

export async function listRequiredDocumentTypes() {
  const { db } = await getTenantDb();
  return db.requiredDocumentType.findMany({ orderBy: { displayOrder: "asc" } });
}

export async function createRequiredDocumentType(input: { name: string; description?: string }) {
  const { db, tenantId } = await getTenantDb();
  const count = await db.requiredDocumentType.count();
  await db.requiredDocumentType.create({
    data: {
      tenantId,
      name: input.name,
      description: input.description,
      displayOrder: count,
    },
  });
  revalidatePath("/admin/settings/documents");
}

export async function updateRequiredDocumentType(input: {
  id: string;
  name?: string;
  description?: string;
  isActive?: boolean;
  displayOrder?: number;
}) {
  const { db } = await getTenantDb();
  const type = await db.requiredDocumentType.findFirst({ where: { id: input.id } });
  if (!type) throw new Error("Document type not found");

  await db.requiredDocumentType.update({
    where: { id: input.id },
    data: {
      name: input.name,
      description: input.description,
      isActive: input.isActive,
      displayOrder: input.displayOrder,
    },
  });
  revalidatePath("/admin/settings/documents");
}

/**
 * Idempotent: creates a NOT_UPLOADED ConnectionDocument for every active
 * RequiredDocumentType this tenant has that the connection doesn't already
 * have one for. Safe to call every time the Documents tab loads.
 */
export async function ensureConnectionDocuments(connectionId: string) {
  const { db, tenantId } = await getTenantDb();
  const connection = await db.connection.findFirst({ where: { id: connectionId } });
  if (!connection) throw new Error("Connection not found");

  const [types, existing] = await Promise.all([
    db.requiredDocumentType.findMany({ where: { isActive: true } }),
    db.connectionDocument.findMany({ where: { connectionId } }),
  ]);
  const existingTypeIds = new Set(existing.map((d) => d.requiredDocumentTypeId));
  const missing = types.filter((t) => !existingTypeIds.has(t.id));
  if (missing.length === 0) return;

  await db.connectionDocument.createMany({
    data: missing.map((t) => ({
      tenantId,
      connectionId,
      requiredDocumentTypeId: t.id,
    })),
  });
}

export async function updateDocumentStatus(input: {
  connectionDocumentId: string;
  status: DocumentStatus;
  remarks?: string;
}) {
  const { db } = await getTenantDb();
  const doc = await db.connectionDocument.findFirst({ where: { id: input.connectionDocumentId } });
  if (!doc) throw new Error("Document not found");

  await db.connectionDocument.update({
    where: { id: input.connectionDocumentId },
    data: { status: input.status, remarks: input.remarks },
  });
  revalidatePath(`/admin/connections/${doc.connectionId}`);
}
