"use server";

import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { revalidatePath } from "next/cache";
import { getTenantDb } from "@/lib/tenantDb";
import { requireAdmin } from "@/lib/permissions";
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

const MAX_DOCUMENT_BYTES = 8 * 1024 * 1024;

// Same disk-write pattern as uploadSitePhoto (src/server/connections.ts) —
// public/uploads/<tenantId>/<connectionId>/<uuid><ext>, capped at 8MB. Images
// and PDFs both accepted since documents like Aadhaar/electricity bills are
// commonly scanned as either.
export async function uploadConnectionDocument(formData: FormData) {
  const { db, tenantId } = await getTenantDb();
  const connectionDocumentId = String(formData.get("connectionDocumentId") || "");
  const file = formData.get("file");

  const doc = await db.connectionDocument.findFirst({ where: { id: connectionDocumentId } });
  if (!doc) throw new Error("Document not found");
  if (!(file instanceof File) || file.size === 0) throw new Error("No file provided");
  if (!file.type.startsWith("image/") && file.type !== "application/pdf") {
    throw new Error("Only image or PDF files are allowed");
  }
  if (file.size > MAX_DOCUMENT_BYTES) throw new Error("File is too large (max 8MB)");

  const session = await requireAdmin();
  const ext = path.extname(file.name) || ".pdf";
  const fileName = `${randomUUID()}${ext}`;
  const relativeDir = path.join("uploads", tenantId, doc.connectionId);
  const uploadDir = path.join(process.cwd(), "public", relativeDir);
  await mkdir(uploadDir, { recursive: true });
  await writeFile(path.join(uploadDir, fileName), Buffer.from(await file.arrayBuffer()));

  await db.connectionDocument.update({
    where: { id: connectionDocumentId },
    data: {
      filePath: path.join(relativeDir, fileName).split(path.sep).join("/"),
      originalName: file.name,
      uploadedAt: new Date(),
      uploadedById: session.user.id,
      status: "UPLOADED",
    },
  });
  revalidatePath(`/admin/connections/${doc.connectionId}`);
}
