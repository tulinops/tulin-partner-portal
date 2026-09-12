"use server";

import { revalidatePath } from "next/cache";
import { getTenantDb } from "@/lib/tenantDb";
import type { ConnectionStatus, SubsidyStatus } from "@/generated/prisma/enums";

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

export async function recordSiteInspection(input: {
  connectionId: string;
  siteInspectionDate: Date;
  siteInspectorName: string;
  siteInspectionNotes?: string;
}) {
  const { db } = await getTenantDb();
  const connection = await db.connection.findFirst({ where: { id: input.connectionId } });
  if (!connection) throw new Error("Connection not found");

  await db.connection.update({
    where: { id: input.connectionId },
    data: {
      siteInspectionDate: input.siteInspectionDate,
      siteInspectorName: input.siteInspectorName,
      siteInspectionNotes: input.siteInspectionNotes,
      // Convenience nudge only — the Admin can still override via the status card.
      status: connection.status === "SITE_INSPECTION_PENDING" ? "SITE_INSPECTION_DONE" : connection.status,
    },
  });
  revalidatePath(`/admin/connections/${input.connectionId}`);
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
