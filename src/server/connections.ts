"use server";

import { randomUUID } from "node:crypto";
import path from "node:path";
import { put, del } from "@vercel/blob";
import { revalidatePath } from "next/cache";
import { getTenantDb } from "@/lib/tenantDb";
import { computeConnectionStage } from "@/lib/connectionStage";
import { asActionResult } from "@/lib/actionResult";
import {
  isInspectionComplete,
  areRequiredSitePhotosComplete,
  MAX_PHOTOS_PER_CATEGORY,
} from "@/lib/siteVisitReadiness";
import type {
  ConnectionStatus,
  SubsidyStatus,
  SiteVisitStatus,
  SiteVisitResult,
  SitePhotoCategory,
  FinancingMethod,
  LoanStatus,
  InstallationStatus,
  EquipmentType,
  WarrantyType,
} from "@/generated/prisma/enums";

export async function listConnections() {
  const { db } = await getTenantDb();
  return db.connection.findMany({
    include: { payments: true, inventoryTxns: true },
    orderBy: { createdAt: "desc" },
  });
}

// Used by leads.ts to evaluate estimate-lock state without duplicating the
// stage-computation query shape — a lead's Connection (if any) determines
// whether its final estimate has moved past the point where pricing freezes.
export async function getConnectionStageForLead(leadId: string) {
  const { db } = await getTenantDb();
  const connection = await db.connection.findFirst({
    where: { leadId },
    include: {
      connectionDocuments: true,
      loanApplications: { orderBy: { createdAt: "desc" } },
      warrantyRecords: true,
    },
  });
  if (!connection) return null;

  const documentsVerified =
    connection.connectionDocuments.length > 0 &&
    connection.connectionDocuments.every((d) => d.status === "VERIFIED");
  const currentLoanApplication = connection.loanApplications.find((l) => l.isCurrent) ?? null;

  return computeConnectionStage({
    siteVisitStatus: connection.siteVisitStatus,
    documentsVerified,
    subsidyStatus: connection.subsidyStatus,
    currentLoanStatus: currentLoanApplication?.status ?? null,
    installationStatus: connection.installationStatus,
    connectionStatus: connection.status,
    warrantyRecordCount: connection.warrantyRecords.length,
  });
}

export async function getConnectionDetail(connectionId: string) {
  const { db } = await getTenantDb();
  const connection = await db.connection.findFirst({
    where: { id: connectionId },
    include: {
      lead: {
        include: {
          estimates: { orderBy: { version: "desc" } },
          notes: { orderBy: { createdAt: "desc" } },
        },
      },
      payments: { orderBy: { paidAt: "desc" } },
      inventoryTxns: { include: { inventoryItem: true }, orderBy: { createdAt: "desc" } },
      staffMember: true,
      sitePhotos: { orderBy: { uploadedAt: "desc" } },
      connectionDocuments: {
        include: { requiredDocumentType: true },
        orderBy: { requiredDocumentType: { displayOrder: "asc" } },
      },
      loanApplications: { orderBy: { createdAt: "desc" } },
      warrantyRecords: { orderBy: { createdAt: "asc" } },
      invoice: true,
    },
  });
  if (!connection) return null;

  const amountCollected = connection.payments.reduce((sum, p) => sum + Number(p.amount), 0);
  const allocatedCost = connection.inventoryTxns
    .filter((t) => t.type === "ALLOCATION")
    .reduce((sum, t) => sum + Number(t.quantity) * Number(t.unitCost ?? 0), 0);
  const profit = amountCollected - allocatedCost;

  const documentsVerified =
    connection.connectionDocuments.length > 0 &&
    connection.connectionDocuments.every((d) => d.status === "VERIFIED");

  const currentLoanApplication = connection.loanApplications.find((l) => l.isCurrent) ?? null;
  const loanPendingAmount = currentLoanApplication
    ? Number(currentLoanApplication.loanAmount) - Number(currentLoanApplication.paymentReceivedByProprietorAmount ?? 0)
    : null;

  const warrantyRecordsWithExpiry = connection.warrantyRecords.map((w) => ({
    ...w,
    expiryDate: addMonths(w.startDate, w.periodMonths),
  }));

  const siteInspectionDetails = (connection.siteInspectionDetails ?? null) as SiteInspectionDetails | null;
  const installedEquipment = (connection.installedEquipment ?? []) as InstalledEquipmentItem[];

  const stage = computeConnectionStage({
    siteVisitStatus: connection.siteVisitStatus,
    documentsVerified,
    subsidyStatus: connection.subsidyStatus,
    currentLoanStatus: currentLoanApplication?.status ?? null,
    installationStatus: connection.installationStatus,
    connectionStatus: connection.status,
    warrantyRecordCount: connection.warrantyRecords.length,
  });

  return {
    connection,
    amountCollected,
    allocatedCost,
    profit,
    documentsVerified,
    currentLoanApplication,
    loanPendingAmount,
    warrantyRecordsWithExpiry,
    siteInspectionDetails,
    installedEquipment,
    stage,
  };
}

function addMonths(date: Date, months: number) {
  const result = new Date(date);
  result.setMonth(result.getMonth() + months);
  return result;
}

// Property-inspection fields as one JSON blob rather than individually typed
// columns — the kind of business-specific data shape likely to differ per
// solar proprietor. See prisma/schema.prisma's Connection.siteInspectionDetails.
export type SiteInspectionDetails = {
  roofType?: string;
  roofCondition?: string;
  roofAreaSqft?: number;
  shadowObstruction?: string;
  orientation?: string;
  roofAccess?: string;
  electricalConnectionDetails?: string;
  meterInformation?: string;
  otherRequirements?: string;
};

async function assertCanCompleteSiteVisit(
  db: Awaited<ReturnType<typeof getTenantDb>>["db"],
  connectionId: string,
  connection: { siteInspectionDetails: unknown },
) {
  const details = (connection.siteInspectionDetails ?? null) as SiteInspectionDetails | null;
  const photos = await db.sitePhoto.findMany({ where: { connectionId }, select: { category: true } });
  if (!isInspectionComplete(details) || !areRequiredSitePhotosComplete(photos)) {
    throw new Error(
      "Complete the property inspection and upload Roof/Meter/Install area photos before marking the site visit complete.",
    );
  }
}

// Same pattern as EstimateLineItem — always read/edited together per
// connection, never queried individually across connections.
export type InstalledEquipmentItem = {
  type: EquipmentType;
  brand?: string;
  model?: string;
  serialNumber?: string;
  quantity: number;
  notes?: string;
  // Which stock item this row was actually pulled from — a tenant can stock
  // several SKUs for the same EquipmentType, so this can't be inferred
  // automatically and is picked explicitly per row on the Installation tab.
  // Rows without one (e.g. anything not tracked in Inventory) are simply
  // skipped by the auto-deduction in recordInstallationSignOff.
  inventoryItemId?: string;
};

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

  if (input.status === "COMPLETED") {
    await assertCanCompleteSiteVisit(db, input.connectionId, connection);
  }

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

export async function recordSiteInspectionDetails(input: {
  connectionId: string;
  details: SiteInspectionDetails;
}) {
  const { db } = await getTenantDb();
  const connection = await db.connection.findFirst({ where: { id: input.connectionId } });
  if (!connection) throw new Error("Connection not found");

  await db.connection.update({
    where: { id: input.connectionId },
    data: { siteInspectionDetails: input.details },
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

  // Recording a result always completes the visit (see below), so it needs
  // the same precondition check updateSiteVisitStatus applies for COMPLETED.
  await assertCanCompleteSiteVisit(db, input.connectionId, connection);

  // Recording a result is how a proprietor says "the visit happened" — it
  // completes the visit itself, same "nudge" pattern updateSiteVisitStatus
  // uses, so the stage tracker actually advances to Documents from here
  // instead of requiring a separate trip to the Status dropdown above.
  await db.connection.update({
    where: { id: input.connectionId },
    data: {
      siteVisitResult: input.result,
      siteVisitWorkerNotes: input.workerNotes,
      siteVisitStatus: "COMPLETED",
      status: connection.status === "SITE_INSPECTION_PENDING" ? "SITE_INSPECTION_DONE" : connection.status,
    },
  });
  revalidatePath(`/admin/connections/${input.connectionId}`);
}

const MAX_PHOTO_BYTES = 8 * 1024 * 1024;

export async function uploadSitePhoto(formData: FormData) {
  return asActionResult(async () => {
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

    const existingCount = await db.sitePhoto.count({ where: { connectionId, category } });
    if (existingCount >= MAX_PHOTOS_PER_CATEGORY) {
      throw new Error(`Up to ${MAX_PHOTOS_PER_CATEGORY} photos allowed per category — delete one first to add another.`);
    }

    const ext = path.extname(file.name) || ".jpg";
    const fileName = `${randomUUID()}${ext}`;
    const pathname = `uploads/${tenantId}/${connectionId}/${fileName}`;
    const bytes = Buffer.from(await file.arrayBuffer());
    const blob = await put(pathname, bytes, { access: "public", contentType: file.type });

    await db.sitePhoto.create({
      data: {
        tenantId,
        connectionId,
        category,
        filePath: blob.url,
        originalName: file.name,
      },
    });
    revalidatePath(`/admin/connections/${connectionId}`);
  });
}

export async function deleteSitePhoto(input: { id: string; connectionId: string }) {
  return asActionResult(async () => {
    const { db } = await getTenantDb();
    const photo = await db.sitePhoto.findFirst({ where: { id: input.id, connectionId: input.connectionId } });
    if (!photo) throw new Error("Photo not found");

    await db.sitePhoto.delete({ where: { id: input.id } });
    await del(photo.filePath).catch(() => {});
    revalidatePath(`/admin/connections/${input.connectionId}`);
  });
}

export async function selectFinancingMethod(input: { connectionId: string; method: FinancingMethod }) {
  return asActionResult(async () => {
    const { db } = await getTenantDb();
    const connection = await db.connection.findFirst({ where: { id: input.connectionId } });
    if (!connection) throw new Error("Connection not found");

    await db.connection.update({
      where: { id: input.connectionId },
      data: { financingMethod: input.method },
    });
    revalidatePath(`/admin/connections/${input.connectionId}`);
  });
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

// ---------- Loan applications ----------

export async function createLoanApplication(input: {
  connectionId: string;
  bankName: string;
  applicationNumber?: string;
  loanAmount: number;
  applicationDate?: Date;
}) {
  const { db, tenantId } = await getTenantDb();
  const connection = await db.connection.findFirst({ where: { id: input.connectionId } });
  if (!connection) throw new Error("Connection not found");

  // Same convenience nudge as updateSubsidyApplication's APPLIED case — the
  // loan branch was missing this entirely, so a loan-financed connection's
  // status badge never left SITE_INSPECTION_DONE no matter how far the loan
  // actually progressed.
  const nextStatus = connection.status === "SITE_INSPECTION_DONE" ? "SUBSIDY_APPLIED" : connection.status;

  // Supersede any prior application for this connection, same
  // supersede-and-mark-current pattern as Estimate.version/isCurrent.
  await db.$transaction(async (tx) => {
    await tx.loanApplication.updateMany({
      where: { connectionId: input.connectionId },
      data: { isCurrent: false },
    });
    await tx.loanApplication.create({
      data: {
        tenantId,
        connectionId: input.connectionId,
        bankName: input.bankName,
        applicationNumber: input.applicationNumber,
        loanAmount: input.loanAmount,
        applicationDate: input.applicationDate,
      },
    });
    await tx.connection.update({ where: { id: input.connectionId }, data: { status: nextStatus } });
  });
  revalidatePath(`/admin/connections/${input.connectionId}`);
}

export async function updateLoanApplication(input: {
  id: string;
  status: LoanStatus;
  sanctionedAt?: Date;
  sanctionedAmount?: number;
  disbursedAmount?: number;
  disbursedAt?: Date;
  paymentReceivedByProprietorAmount?: number;
  paymentReceivedByProprietorAt?: Date;
  paymentReference?: string;
  notes?: string;
}) {
  const { db } = await getTenantDb();
  const loan = await db.loanApplication.findFirst({ where: { id: input.id } });
  if (!loan) throw new Error("Loan application not found");
  const connection = await db.connection.findFirst({ where: { id: loan.connectionId } });
  if (!connection) throw new Error("Connection not found");

  // Mirrors updateSubsidyApplication's APPROVED nudge, so both financing
  // paths reach the same "SUBSIDY_APPROVED" checkpoint that
  // updateInstallationStatus's own nudge requires to advance further —
  // without this, only subsidy-financed connections could ever move their
  // status badge past this point.
  const nextStatus = input.status === "APPROVED" && connection.status === "SUBSIDY_APPLIED" ? "SUBSIDY_APPROVED" : connection.status;

  await db.$transaction([
    db.loanApplication.update({
      where: { id: input.id },
      data: {
        status: input.status,
        sanctionedAt: input.sanctionedAt,
        sanctionedAmount: input.sanctionedAmount,
        disbursedAmount: input.disbursedAmount,
        disbursedAt: input.disbursedAt,
        paymentReceivedByProprietorAmount: input.paymentReceivedByProprietorAmount,
        paymentReceivedByProprietorAt: input.paymentReceivedByProprietorAt,
        paymentReference: input.paymentReference,
        notes: input.notes,
      },
    }),
    db.connection.update({ where: { id: loan.connectionId }, data: { status: nextStatus } }),
  ]);
  revalidatePath(`/admin/connections/${loan.connectionId}`);
}

// ---------- Installation ----------

export async function updateInstallationStatus(input: { connectionId: string; status: InstallationStatus }) {
  const { db } = await getTenantDb();
  const connection = await db.connection.findFirst({ where: { id: input.connectionId } });
  if (!connection) throw new Error("Connection not found");

  // Convenience nudge only — the Admin can still override via the overall status card.
  let nextConnectionStatus = connection.status;
  if (input.status === "IN_PROGRESS" && connection.status === "SUBSIDY_APPROVED") {
    nextConnectionStatus = "INSTALLATION_IN_PROGRESS";
  } else if (input.status === "COMPLETED" && connection.status === "INSTALLATION_IN_PROGRESS") {
    nextConnectionStatus = "COMPLETED";
  }

  await db.connection.update({
    where: { id: input.connectionId },
    data: { installationStatus: input.status, status: nextConnectionStatus },
  });
  revalidatePath(`/admin/connections/${input.connectionId}`);
}

function assertInstalledEquipmentEditable(connection: { installationStatus: string }) {
  if (connection.installationStatus === "COMPLETED") {
    throw new Error("Installation is marked Completed — change the status above to edit equipment");
  }
}

export async function updateInstalledEquipment(input: { connectionId: string; items: InstalledEquipmentItem[] }) {
  const { db } = await getTenantDb();
  const connection = await db.connection.findFirst({ where: { id: input.connectionId } });
  if (!connection) throw new Error("Connection not found");
  assertInstalledEquipmentEditable(connection);

  await db.connection.update({
    where: { id: input.connectionId },
    data: { installedEquipment: input.items },
  });
  revalidatePath(`/admin/connections/${input.connectionId}`);
}

export async function recordInstallationSignOff(input: { connectionId: string; signedOffByName: string; notes?: string }) {
  const { db, tenantId } = await getTenantDb();

  await db.$transaction(async (tx) => {
    const connection = await tx.connection.findFirst({ where: { id: input.connectionId } });
    if (!connection) throw new Error("Connection not found");

    await tx.connection.update({
      where: { id: input.connectionId },
      data: {
        installationSignedOffAt: new Date(),
        installationSignedOffByName: input.signedOffByName,
        installationNotes: input.notes,
        installationStatus: "COMPLETED",
        status: connection.status === "INSTALLATION_IN_PROGRESS" ? "COMPLETED" : connection.status,
      },
    });

    const equipment = (connection.installedEquipment ?? []) as InstalledEquipmentItem[];

    // Auto-create sensible default warranty records from the installed
    // equipment, per product type — a convenience, not a hard requirement;
    // fully editable afterward. Skips types that already have a record.
    const existing = await tx.warrantyRecord.findMany({ where: { connectionId: input.connectionId } });
    const existingTypes = new Set(existing.map((w) => w.equipmentType));
    const defaults: { type: EquipmentType; months: number }[] = [
      { type: "PANEL", months: 300 },
      { type: "INVERTER", months: 96 },
    ];
    for (const { type, months } of defaults) {
      const item = equipment.find((e) => e.type === type);
      if (!item || existingTypes.has(type)) continue;
      await tx.warrantyRecord.create({
        data: {
          tenantId,
          connectionId: input.connectionId,
          equipmentType: type,
          productName: type === "PANEL" ? "Solar Panels" : "Inverter",
          manufacturer: item.brand,
          model: item.model,
          serialNumber: type === "INVERTER" ? item.serialNumber : undefined,
          startDate: new Date(),
          periodMonths: months,
        },
      });
    }

    // Auto-deduct each installed-equipment row that was matched to a stock
    // item (see InstalledEquipmentItem.inventoryItemId). Reconciled against
    // what's already been allocated to this connection (rather than gated on
    // "first sign-off only") so re-submitting "Mark installation complete" —
    // e.g. after mapping a row to inventory that wasn't mapped yet — deducts
    // just the newly-needed amount instead of silently doing nothing.
    // Unmatched rows (nothing tracked in Inventory for that item) are simply
    // skipped, same as before this existed. Note: this only ever deducts —
    // lowering a row's quantity or swapping its inventory item after stock
    // was already taken does not return that stock automatically.
    const neededByItem = new Map<string, number>();
    for (const item of equipment) {
      if (!item.inventoryItemId || !(item.quantity > 0)) continue;
      neededByItem.set(item.inventoryItemId, (neededByItem.get(item.inventoryItemId) ?? 0) + item.quantity);
    }

    const existingAllocations = await tx.inventoryTransaction.groupBy({
      by: ["inventoryItemId"],
      where: { connectionId: input.connectionId, type: "ALLOCATION" },
      _sum: { quantity: true },
    });
    const allocatedByItem = new Map(
      existingAllocations.map((a) => [a.inventoryItemId, Number(a._sum.quantity ?? 0)]),
    );

    for (const [inventoryItemId, neededQty] of neededByItem) {
      const deltaQty = neededQty - (allocatedByItem.get(inventoryItemId) ?? 0);
      if (deltaQty <= 0) continue;

      const invItem = await tx.inventoryItem.findFirst({ where: { id: inventoryItemId } });
      if (!invItem) throw new Error(`Inventory item not found`);
      if (Number(invItem.runningStock) < deltaQty) {
        throw new Error(`Not enough stock for ${invItem.name}: ${invItem.runningStock} ${invItem.unit} available`);
      }

      // Weighted-average purchase cost snapshotted onto this allocation —
      // same approach as the (now-removed) manual "Allocate inventory" form.
      const purchases = await tx.inventoryTransaction.findMany({
        where: { inventoryItemId: invItem.id, type: "PURCHASE" },
        select: { quantity: true, unitCost: true },
      });
      const totalPurchasedQty = purchases.reduce((sum, p) => sum + Number(p.quantity), 0);
      const totalPurchasedCost = purchases.reduce(
        (sum, p) => sum + Number(p.quantity) * Number(p.unitCost ?? 0),
        0,
      );
      const avgUnitCost = totalPurchasedQty > 0 ? totalPurchasedCost / totalPurchasedQty : 0;

      await tx.inventoryTransaction.create({
        data: {
          tenantId,
          inventoryItemId: invItem.id,
          connectionId: input.connectionId,
          type: "ALLOCATION",
          quantity: deltaQty,
          unitCost: avgUnitCost,
        },
      });
      await tx.inventoryItem.update({
        where: { id: invItem.id },
        data: { runningStock: { decrement: deltaQty } },
      });
    }
  });

  revalidatePath("/admin/inventory");
  revalidatePath(`/admin/connections/${input.connectionId}`);
}

// ---------- Warranty ----------

export async function createWarrantyRecord(input: {
  connectionId: string;
  equipmentType: EquipmentType;
  productName: string;
  manufacturer?: string;
  model?: string;
  serialNumber?: string;
  warrantyType?: WarrantyType;
  startDate: Date;
  periodMonths: number;
  terms?: string;
}) {
  const { db, tenantId } = await getTenantDb();
  const connection = await db.connection.findFirst({ where: { id: input.connectionId } });
  if (!connection) throw new Error("Connection not found");

  await db.warrantyRecord.create({
    data: {
      tenantId,
      connectionId: input.connectionId,
      equipmentType: input.equipmentType,
      productName: input.productName,
      manufacturer: input.manufacturer,
      model: input.model,
      serialNumber: input.serialNumber,
      warrantyType: input.warrantyType,
      startDate: input.startDate,
      periodMonths: input.periodMonths,
      terms: input.terms,
    },
  });
  revalidatePath(`/admin/connections/${input.connectionId}`);
}

export async function updateWarrantyRecord(input: {
  id: string;
  connectionId: string;
  equipmentType: EquipmentType;
  productName: string;
  manufacturer?: string;
  model?: string;
  serialNumber?: string;
  warrantyType?: WarrantyType;
  startDate: Date;
  periodMonths: number;
  terms?: string;
}) {
  return asActionResult(async () => {
    const { db } = await getTenantDb();
    const record = await db.warrantyRecord.findFirst({
      where: { id: input.id, connectionId: input.connectionId },
    });
    if (!record) throw new Error("Warranty record not found");

    await db.warrantyRecord.update({
      where: { id: input.id },
      data: {
        equipmentType: input.equipmentType,
        productName: input.productName,
        manufacturer: input.manufacturer,
        model: input.model,
        serialNumber: input.serialNumber,
        warrantyType: input.warrantyType,
        startDate: input.startDate,
        periodMonths: input.periodMonths,
        terms: input.terms,
      },
    });
    revalidatePath(`/admin/connections/${input.connectionId}`);
  });
}

export async function deleteWarrantyRecord(input: { id: string; connectionId: string }) {
  const { db } = await getTenantDb();
  const record = await db.warrantyRecord.findFirst({
    where: { id: input.id, connectionId: input.connectionId },
  });
  if (!record) throw new Error("Warranty record not found");

  await db.warrantyRecord.delete({ where: { id: input.id } });
  revalidatePath(`/admin/connections/${input.connectionId}`);
}
