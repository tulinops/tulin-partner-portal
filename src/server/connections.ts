"use server";

import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { revalidatePath } from "next/cache";
import { getTenantDb } from "@/lib/tenantDb";
import type {
  ConnectionStatus,
  SubsidyStatus,
  SiteVisitStatus,
  SiteVisitResult,
  RoofType,
  RoofCondition,
  RoofAccess,
  SitePhotoCategory,
} from "@/generated/prisma/enums";

export async function listConnections() {
  const { db } = await getTenantDb();
  return db.connection.findMany({
    include: { payments: true, inventoryTxns: true },
    orderBy: { createdAt: "desc" },
  });
}

export async function getConnectionDetail(connectionId: string) {
  const { db } = await getTenantDb();
  const connection = await db.connection.findFirst({
    where: { id: connectionId },
    include: {
      lead: { include: { estimates: { orderBy: { version: "desc" } } } },
      payments: { orderBy: { paidAt: "desc" } },
      inventoryTxns: { include: { inventoryItem: true }, orderBy: { createdAt: "desc" } },
      staffMember: true,
      sitePhotos: { orderBy: { uploadedAt: "desc" } },
    },
  });
  if (!connection) return null;

  const amountCollected = connection.payments.reduce((sum, p) => sum + Number(p.amount), 0);
  const allocatedCost = connection.inventoryTxns
    .filter((t) => t.type === "ALLOCATION")
    .reduce((sum, t) => sum + Number(t.quantity) * Number(t.unitCost ?? 0), 0);
  const profit = amountCollected - allocatedCost;

  const documentsVerified = [
    connection.docIdProofVerified,
    connection.docAddressProofVerified,
    connection.docElectricityBillVerified,
    connection.docOwnershipVerified,
    connection.docBankPassbookVerified,
  ].every(Boolean);

  const warrantyExpiryDate =
    connection.warrantyStartDate && connection.warrantyPeriodMonths
      ? addMonths(connection.warrantyStartDate, connection.warrantyPeriodMonths)
      : null;

  return { connection, amountCollected, allocatedCost, profit, documentsVerified, warrantyExpiryDate };
}

function addMonths(date: Date, months: number) {
  const result = new Date(date);
  result.setMonth(result.getMonth() + months);
  return result;
}

export async function recordPayment(input: {
  connectionId: string;
  amount: number;
  note?: string;
}) {
  const { db, tenantId } = await getTenantDb();
  const connection = await db.connection.findFirst({ where: { id: input.connectionId } });
  if (!connection) throw new Error("Connection not found");

  await db.customerPayment.create({
    data: {
      tenantId,
      connectionId: connection.id,
      amount: input.amount,
      note: input.note,
    },
  });
  revalidatePath(`/admin/connections/${input.connectionId}`);
}

export async function updateConnectionStatus(input: {
  connectionId: string;
  status: ConnectionStatus;
  installDate?: Date;
  assignedInstaller?: string;
}) {
  const { db } = await getTenantDb();
  await db.connection.update({
    where: { id: input.connectionId },
    data: {
      status: input.status,
      installDate: input.installDate,
      assignedInstaller: input.assignedInstaller,
    },
  });
  revalidatePath(`/admin/connections/${input.connectionId}`);
  revalidatePath("/admin/connections");
}

export async function assignSiteVisit(input: {
  connectionId: string;
  staffMemberId?: string;
  scheduledAt?: Date;
  instructions?: string;
}) {
  const { db } = await getTenantDb();
  const connection = await db.connection.findFirst({ where: { id: input.connectionId } });
  if (!connection) throw new Error("Connection not found");

  await db.connection.update({
    where: { id: input.connectionId },
    data: {
      staffMemberId: input.staffMemberId,
      siteVisitScheduledAt: input.scheduledAt,
      siteVisitInstructions: input.instructions,
      // Convenience nudge only — the Admin can still override via the status select.
      siteVisitStatus: connection.siteVisitStatus === "PENDING" ? "SCHEDULED" : connection.siteVisitStatus,
    },
  });
  revalidatePath(`/admin/connections/${input.connectionId}`);
}

export async function updateSiteVisitStatus(input: { connectionId: string; status: SiteVisitStatus }) {
  const { db } = await getTenantDb();
  const connection = await db.connection.findFirst({ where: { id: input.connectionId } });
  if (!connection) throw new Error("Connection not found");

  // Convenience nudge only — the Admin can still override via the overall status card.
  const nextConnectionStatus =
    input.status === "COMPLETED" && connection.status === "SITE_INSPECTION_PENDING"
      ? "SITE_INSPECTION_DONE"
      : connection.status;

  await db.connection.update({
    where: { id: input.connectionId },
    data: {
      siteVisitStatus: input.status,
      status: nextConnectionStatus,
    },
  });
  revalidatePath(`/admin/connections/${input.connectionId}`);
}

export async function recordPropertyInspection(input: {
  connectionId: string;
  roofType?: RoofType;
  roofCondition?: RoofCondition;
  roofAreaSqft?: number;
  shadowObstruction?: string;
  orientation?: string;
  roofAccess?: RoofAccess;
  electricalConnectionDetails?: string;
  meterInformation?: string;
  otherSiteRequirements?: string;
}) {
  const { db } = await getTenantDb();
  const connection = await db.connection.findFirst({ where: { id: input.connectionId } });
  if (!connection) throw new Error("Connection not found");

  await db.connection.update({
    where: { id: input.connectionId },
    data: {
      roofType: input.roofType,
      roofCondition: input.roofCondition,
      roofAreaSqft: input.roofAreaSqft,
      shadowObstruction: input.shadowObstruction,
      orientation: input.orientation,
      roofAccess: input.roofAccess,
      electricalConnectionDetails: input.electricalConnectionDetails,
      meterInformation: input.meterInformation,
      otherSiteRequirements: input.otherSiteRequirements,
    },
  });
  revalidatePath(`/admin/connections/${input.connectionId}`);
}

export async function recordSiteVisitResult(input: {
  connectionId: string;
  result: SiteVisitResult;
  workerNotes?: string;
}) {
  const { db } = await getTenantDb();
  const connection = await db.connection.findFirst({ where: { id: input.connectionId } });
  if (!connection) throw new Error("Connection not found");

  await db.connection.update({
    where: { id: input.connectionId },
    data: {
      siteVisitResult: input.result,
      siteVisitWorkerNotes: input.workerNotes,
    },
  });
  revalidatePath(`/admin/connections/${input.connectionId}`);
}

const MAX_PHOTO_BYTES = 8 * 1024 * 1024;

export async function uploadSitePhoto(formData: FormData) {
  const { db, tenantId } = await getTenantDb();
  const connectionId = String(formData.get("connectionId") || "");
  const category = String(formData.get("category") || "") as SitePhotoCategory;
  const file = formData.get("file");

  const connection = await db.connection.findFirst({ where: { id: connectionId } });
  if (!connection) throw new Error("Connection not found");

  if (!(file instanceof File) || file.size === 0) {
    throw new Error("No file provided");
  }
  if (!file.type.startsWith("image/")) {
    throw new Error("Only image files are allowed");
  }
  if (file.size > MAX_PHOTO_BYTES) {
    throw new Error("Image is too large (max 8MB)");
  }

  const ext = path.extname(file.name) || ".jpg";
  const fileName = `${randomUUID()}${ext}`;
  const relativeDir = path.join("uploads", tenantId, connectionId);
  const uploadDir = path.join(process.cwd(), "public", relativeDir);
  await mkdir(uploadDir, { recursive: true });
  const bytes = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(uploadDir, fileName), bytes);

  await db.sitePhoto.create({
    data: {
      tenantId,
      connectionId,
      category,
      filePath: path.join(relativeDir, fileName).split(path.sep).join("/"),
      originalName: file.name,
    },
  });
  revalidatePath(`/admin/connections/${connectionId}`);
}

export async function updateDocumentVerification(input: {
  connectionId: string;
  docIdProofVerified: boolean;
  docAddressProofVerified: boolean;
  docElectricityBillVerified: boolean;
  docOwnershipVerified: boolean;
  docBankPassbookVerified: boolean;
  documentNotes?: string;
}) {
  const { db } = await getTenantDb();
  const connection = await db.connection.findFirst({ where: { id: input.connectionId } });
  if (!connection) throw new Error("Connection not found");

  await db.connection.update({
    where: { id: input.connectionId },
    data: {
      docIdProofVerified: input.docIdProofVerified,
      docAddressProofVerified: input.docAddressProofVerified,
      docElectricityBillVerified: input.docElectricityBillVerified,
      docOwnershipVerified: input.docOwnershipVerified,
      docBankPassbookVerified: input.docBankPassbookVerified,
      documentNotes: input.documentNotes,
    },
  });
  revalidatePath(`/admin/connections/${input.connectionId}`);
}

export async function updateSubsidyApplication(input: {
  connectionId: string;
  subsidyScheme?: string;
  subsidyApplicationRefNo?: string;
  subsidyAppliedAmount?: number;
  subsidyApprovedAmount?: number;
  subsidyStatus: SubsidyStatus;
  subsidyAppliedAt?: Date;
  subsidyApprovedAt?: Date;
  subsidyDisbursedAt?: Date;
}) {
  const { db } = await getTenantDb();
  const connection = await db.connection.findFirst({ where: { id: input.connectionId } });
  if (!connection) throw new Error("Connection not found");

  // Convenience nudge only — the Admin can still override via the status card.
  let nextStatus = connection.status;
  if (input.subsidyStatus === "APPLIED" && connection.status === "SITE_INSPECTION_DONE") {
    nextStatus = "SUBSIDY_APPLIED";
  } else if (input.subsidyStatus === "APPROVED" && connection.status === "SUBSIDY_APPLIED") {
    nextStatus = "SUBSIDY_APPROVED";
  }

  await db.connection.update({
    where: { id: input.connectionId },
    data: {
      subsidyScheme: input.subsidyScheme,
      subsidyApplicationRefNo: input.subsidyApplicationRefNo,
      subsidyAppliedAmount: input.subsidyAppliedAmount,
      subsidyApprovedAmount: input.subsidyApprovedAmount,
      subsidyStatus: input.subsidyStatus,
      subsidyAppliedAt: input.subsidyAppliedAt,
      subsidyApprovedAt: input.subsidyApprovedAt,
      subsidyDisbursedAt: input.subsidyDisbursedAt,
      status: nextStatus,
    },
  });
  revalidatePath(`/admin/connections/${input.connectionId}`);
}

export async function updateWarranty(input: {
  connectionId: string;
  warrantyStartDate: Date;
  warrantyPeriodMonths: number;
  warrantyNotes?: string;
}) {
  const { db } = await getTenantDb();
  const connection = await db.connection.findFirst({ where: { id: input.connectionId } });
  if (!connection) throw new Error("Connection not found");

  await db.connection.update({
    where: { id: input.connectionId },
    data: {
      warrantyStartDate: input.warrantyStartDate,
      warrantyPeriodMonths: input.warrantyPeriodMonths,
      warrantyNotes: input.warrantyNotes,
    },
  });
  revalidatePath(`/admin/connections/${input.connectionId}`);
}
