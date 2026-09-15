"use server";

import { revalidatePath } from "next/cache";
import { getTenantDb } from "@/lib/tenantDb";
import { getConnectionStageForLead } from "@/server/connections";
import { isEstimateLocked, STAGE_ORDER } from "@/lib/connectionStage";
import type { LeadSource, LeadStage, EstimateStatus, SolarBrand } from "@/generated/prisma/enums";
import type { TenantScopedClient } from "@/lib/db";

export async function listLeads() {
  const { db } = await getTenantDb();
  return db.lead.findMany({
    include: { notes: { orderBy: { createdAt: "desc" } }, connection: true },
    orderBy: { createdAt: "desc" },
  });
}

export async function getLead(leadId: string) {
  const { db } = await getTenantDb();
  return db.lead.findFirst({
    where: { id: leadId },
    include: {
      notes: { orderBy: { createdAt: "desc" } },
      connection: true,
      estimates: { orderBy: { version: "desc" } },
    },
  });
}

export async function createLead(input: {
  customerName: string;
  phone: string;
  source: LeadSource;
  estimatedValue?: number;
  email?: string;
  requirementNotes?: string;
}) {
  const { db, tenantId } = await getTenantDb();
  await db.lead.create({
    data: {
      tenantId,
      customerName: input.customerName,
      phone: input.phone,
      source: input.source,
      estimatedValue: input.estimatedValue,
      email: input.email,
      requirementNotes: input.requirementNotes,
    },
  });
  revalidatePath("/admin/leads");
}

export async function updateLeadDetails(input: {
  leadId: string;
  email?: string;
  address?: string;
  requirementNotes?: string;
}) {
  const { db } = await getTenantDb();
  const lead = await db.lead.findFirst({ where: { id: input.leadId } });
  if (!lead) throw new Error("Lead not found");

  await db.lead.update({
    where: { id: input.leadId },
    data: { email: input.email, address: input.address, requirementNotes: input.requirementNotes },
  });
  revalidatePath(`/admin/leads/${input.leadId}`);
}

// The interactive-transaction client Prisma hands to a $transaction callback
// omits $connect/$disconnect/$extends/etc — it is not quite TenantScopedClient
// itself, so it's derived here rather than reusing that type directly.
type TenantTxClient = Parameters<Parameters<TenantScopedClient["$transaction"]>[0]>[0];

// Shared by moveLeadStage("WON") and updateEstimateStatus("ACCEPTED") — both
// are really "start the customer journey" triggered from different places in
// the UI, so they must produce the identical Connection, not two
// slightly-different paths to the same outcome.
async function createConnectionFromLead(
  tx: TenantTxClient,
  lead: { id: string; customerName: string; phone: string; address: string | null },
  tenantId: string,
  systemSizeKw: number | undefined,
) {
  await tx.lead.update({ where: { id: lead.id }, data: { stage: "WON" } });
  await tx.connection.create({
    data: {
      tenantId,
      leadId: lead.id,
      customerName: lead.customerName,
      phone: lead.phone,
      address: lead.address ?? undefined,
      systemSizeKw: systemSizeKw ?? undefined,
    },
  });
}

// "WON" is deliberately excluded here — it's only ever set as a byproduct of
// approving a quotation (updateEstimateStatus -> "ACCEPTED") actually
// creating the Connection (via createConnectionFromLead). A manual stage
// button bypassed that guard, so Won can no longer be set this way.
export async function moveLeadStage(leadId: string, stage: Exclude<LeadStage, "WON">) {
  const { db } = await getTenantDb();
  const lead = await db.lead.findFirst({ where: { id: leadId }, include: { connection: true } });
  if (!lead) throw new Error("Lead not found");
  // Once a lead has converted, its pre-conversion funnel stage is no longer
  // meaningful — real progress lives on the Connection from here on. Without
  // this guard, the still-clickable stage buttons could silently regress
  // Lead.stage (e.g. back to "SITE_VISIT") on a lead whose Connection has
  // already reached Installation or beyond.
  if (lead.connection) throw new Error("This lead has already converted — its stage can no longer be changed manually");

  await db.lead.update({ where: { id: leadId }, data: { stage } });
  revalidatePath("/admin/leads");
  revalidatePath(`/admin/leads/${leadId}`);
}

export async function addLeadNote(input: {
  leadId: string;
  body: string;
  followUpAt?: Date;
}) {
  const { db, tenantId } = await getTenantDb();
  // The Lead relation on LeadNote requires an existing Lead within this
  // tenant — findFirst is scoped by the extension, so this 404s cleanly for
  // a cross-tenant id instead of ever writing a stray note.
  const lead = await db.lead.findFirst({ where: { id: input.leadId } });
  if (!lead) throw new Error("Lead not found");

  await db.leadNote.create({
    data: {
      tenantId,
      leadId: input.leadId,
      body: input.body,
      followUpAt: input.followUpAt,
    },
  });
  revalidatePath(`/admin/leads/${input.leadId}`);
}

// ---------- Estimates ----------

export type EstimateLineItem = {
  description: string;
  spec?: string;
  // Per-item brand — different components (panels vs. inverter vs. balance
  // of system) can legitimately come from different manufacturers, so this
  // replaces what used to be a single brand for the whole estimate.
  brand?: string;
  qty: number;
  rate: number;
  amount: number;
  // Per-item GST — different line items (panels vs. balance-of-system vs.
  // labor) can legitimately sit in different GST slabs, so this replaces
  // what used to be a single flat GST% for the whole estimate.
  gstPercent: number;
};

function computeEstimateTotals(items: EstimateLineItem[]) {
  const subtotal = items.reduce((sum, li) => sum + li.amount, 0);
  const gstAmount = items.reduce((sum, li) => sum + li.amount * ((li.gstPercent || 0) / 100), 0);
  const totalAmount = subtotal + gstAmount;
  // Estimate.gstPercent is no longer an input — it's the blended/effective
  // rate derived from the line items, kept only for display (e.g. the
  // printed estimate's "GST (X%)" summary row) and analytics.
  const gstPercent = subtotal > 0 ? (gstAmount / subtotal) * 100 : 0;
  return { subtotal, gstAmount, totalAmount, gstPercent };
}

async function generateEstimateNumber(tenantSlug: string) {
  const now = new Date();
  // April–March fiscal year, matching Indian convention (and quotation.html's
  // own SGP/2026-2027/... shape).
  const fiscalStartYear = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  const fiscalYear = `${fiscalStartYear}-${fiscalStartYear + 1}`;
  const stamp =
    now.getFullYear().toString() +
    String(now.getMonth() + 1).padStart(2, "0") +
    String(now.getDate()).padStart(2, "0") +
    String(now.getHours()).padStart(2, "0") +
    String(now.getMinutes()).padStart(2, "0") +
    String(now.getSeconds()).padStart(2, "0");
  // estimateNumber is globally unique, but the stamp above is only
  // second-granular — two quotes created for the same tenant within the same
  // second (e.g. building a comparison quote right after the first) would
  // otherwise collide on Estimate_estimateNumber_key. The random suffix keeps
  // the number unique without needing a DB round trip or retry loop.
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${tenantSlug.toUpperCase()}/${fiscalYear}/${stamp}${suffix}`;
}

export async function createEstimate(input: {
  leadId: string;
  systemSizeKw?: number;
  brand?: SolarBrand;
  lineItems: EstimateLineItem[];
  subsidyEstimate?: number;
  validUntil?: Date;
  notes?: string;
}) {
  const { db, tenantId } = await getTenantDb();
  const lead = await db.lead.findFirst({ where: { id: input.leadId } });
  if (!lead) throw new Error("Lead not found");

  const tenant = await db.tenant.findFirst({ where: { id: tenantId } });
  if (!tenant) throw new Error("Tenant not found");

  // Amounts are always recomputed server-side from qty*rate — client-sent
  // amounts are never trusted.
  const items = input.lineItems
    .filter((li) => li.description.trim().length > 0)
    .map((li) => ({ ...li, amount: li.qty * li.rate, gstPercent: li.gstPercent || 0 }));
  const { subtotal, gstAmount, totalAmount, gstPercent } = computeEstimateTotals(items);
  const estimateNumber = await generateEstimateNumber(tenant.slug);

  // Quotations coexist rather than superseding one another — a lead can have
  // several simultaneous DRAFT quotes, and only Approving one ever makes it
  // isCurrent (the final quote). See updateEstimateStatus.
  const prior = await db.estimate.count({ where: { leadId: input.leadId } });
  await db.estimate.create({
    data: {
      tenantId,
      leadId: input.leadId,
      estimateNumber,
      version: prior + 1,
      isCurrent: false,
      systemSizeKw: input.systemSizeKw,
      brand: input.brand,
      lineItems: items,
      subtotal,
      gstPercent,
      gstAmount,
      totalAmount,
      subsidyEstimate: input.subsidyEstimate,
      validUntil: input.validUntil,
      notes: input.notes,
    },
  });

  revalidatePath(`/admin/leads/${input.leadId}`);
}

// Copies an existing quote as a new DRAFT — used for both the mockup's
// "Duplicate" action and for starting a revision off an already-final quote.
export async function duplicateEstimate(estimateId: string) {
  const { db, tenantId } = await getTenantDb();
  const original = await db.estimate.findFirst({ where: { id: estimateId } });
  if (!original) throw new Error("Estimate not found");

  const tenant = await db.tenant.findFirst({ where: { id: tenantId } });
  if (!tenant) throw new Error("Tenant not found");

  const prior = await db.estimate.count({ where: { leadId: original.leadId } });
  const created = await db.estimate.create({
    data: {
      tenantId,
      leadId: original.leadId,
      estimateNumber: await generateEstimateNumber(tenant.slug),
      version: prior + 1,
      isCurrent: false,
      status: "DRAFT",
      systemSizeKw: original.systemSizeKw ?? undefined,
      brand: original.brand ?? undefined,
      lineItems: original.lineItems as object,
      subtotal: original.subtotal,
      gstPercent: original.gstPercent,
      gstAmount: original.gstAmount,
      totalAmount: original.totalAmount,
      subsidyEstimate: original.subsidyEstimate ?? undefined,
      validUntil: original.validUntil ?? undefined,
      notes: original.notes ?? undefined,
    },
  });

  revalidatePath(`/admin/leads/${original.leadId}`);
  return created.id;
}

async function assertEstimateEditable(
  db: TenantScopedClient,
  estimate: { id: string; leadId: string; status: string; isCurrent: boolean },
) {
  const hasOtherFinalEstimate = await db.estimate.count({
    where: { leadId: estimate.leadId, isCurrent: true, id: { not: estimate.id } },
  });
  const connectionStage = await getConnectionStageForLead(estimate.leadId);
  const locked = isEstimateLocked({
    status: estimate.status,
    isCurrent: estimate.isCurrent,
    hasOtherFinalEstimate: hasOtherFinalEstimate > 0,
    connectionStage,
  });
  if (locked) throw new Error("This quotation is locked and can no longer be edited");
}

// Recomputes totals the same way createEstimate does — the two must never
// drift, since a quote can move between "new" and "edited" freely while DRAFT.
export async function updateEstimateFields(
  estimateId: string,
  input: {
    systemSizeKw?: number;
    brand?: SolarBrand;
    lineItems?: EstimateLineItem[];
    subsidyEstimate?: number;
    validUntil?: Date;
    notes?: string;
  },
) {
  const { db } = await getTenantDb();
  const estimate = await db.estimate.findFirst({ where: { id: estimateId } });
  if (!estimate) throw new Error("Estimate not found");
  await assertEstimateEditable(db, estimate);

  const items = input.lineItems
    ?.filter((li) => li.description.trim().length > 0)
    .map((li) => ({ ...li, amount: li.qty * li.rate, gstPercent: li.gstPercent || 0 }));
  const totals = items ? computeEstimateTotals(items) : undefined;

  await db.estimate.update({
    where: { id: estimateId },
    data: {
      systemSizeKw: input.systemSizeKw,
      brand: input.brand,
      lineItems: items,
      subtotal: totals?.subtotal,
      gstPercent: totals?.gstPercent,
      gstAmount: totals?.gstAmount,
      totalAmount: totals?.totalAmount,
      subsidyEstimate: input.subsidyEstimate,
      validUntil: input.validUntil,
      notes: input.notes,
    },
  });
  revalidatePath(`/admin/leads/${estimate.leadId}`);
}

// Deliberately more lenient than assertEstimateEditable: approving a DRAFT
// swaps which quote is final, so a non-final quote must stay approvable even
// though its *fields* are read-only once another quote has been finalized.
// The only hard stops are an explicit LOCKED status, or the job having
// already moved into Subsidy/Loan or later — at that point no quote's status
// can change at all, final or not.
async function assertEstimateStatusChangeAllowed(estimate: { leadId: string; status: string }) {
  if (estimate.status === "LOCKED") {
    throw new Error("This quotation is locked and can no longer be changed");
  }
  const connectionStage = await getConnectionStageForLead(estimate.leadId);
  if (connectionStage !== null && STAGE_ORDER.indexOf(connectionStage) >= STAGE_ORDER.indexOf("subsidyloan")) {
    throw new Error("This lead has moved past the estimate stage; quotations are locked");
  }
}

// Approving a quote (status -> ACCEPTED) is what makes it the lead's final
// quotation: it becomes isCurrent, and any previously-final quote is demoted
// back to SENT and loses isCurrent, matching the mockup's
// onEstStatusChange/"Approved" behavior. It also converts the lead into a
// customer in the same transaction — approval is the one moment that used
// to require a separate "Schedule site visit" click, which was an easy
// irreversible action to trigger by accident right after approving.
export async function updateEstimateStatus(estimateId: string, status: EstimateStatus) {
  const { db, tenantId } = await getTenantDb();
  const estimate = await db.estimate.findFirst({
    where: { id: estimateId },
    include: { lead: { include: { connection: true } } },
  });
  if (!estimate) throw new Error("Estimate not found");
  await assertEstimateStatusChangeAllowed(estimate);

  if (status === "ACCEPTED") {
    await db.$transaction(async (tx) => {
      await tx.estimate.updateMany({
        where: { leadId: estimate.leadId, isCurrent: true, id: { not: estimateId } },
        data: { isCurrent: false, status: "SENT" },
      });
      await tx.estimate.update({ where: { id: estimateId }, data: { status: "ACCEPTED", isCurrent: true } });

      if (!estimate.lead.connection) {
        await createConnectionFromLead(
          tx,
          estimate.lead,
          tenantId,
          estimate.systemSizeKw ? Number(estimate.systemSizeKw) : undefined,
        );
      }
    });
  } else {
    await db.estimate.update({ where: { id: estimateId }, data: { status } });
  }

  revalidatePath(`/admin/leads/${estimate.leadId}`);
  revalidatePath(`/admin/estimates/${estimateId}`);
  revalidatePath("/admin/leads");
  revalidatePath("/admin/connections");
}

// Refuses to leave a lead with zero quotations — there must always be at
// least one to build from.
export async function deleteEstimate(estimateId: string) {
  const { db } = await getTenantDb();
  const estimate = await db.estimate.findFirst({ where: { id: estimateId } });
  if (!estimate) throw new Error("Estimate not found");
  await assertEstimateStatusChangeAllowed(estimate);

  const total = await db.estimate.count({ where: { leadId: estimate.leadId } });
  if (total <= 1) throw new Error("A lead must have at least one quotation");

  await db.estimate.delete({ where: { id: estimateId } });
  revalidatePath(`/admin/leads/${estimate.leadId}`);
}

export async function getEstimate(estimateId: string) {
  const { db } = await getTenantDb();
  return db.estimate.findFirst({
    where: { id: estimateId },
    include: { lead: true, tenant: true },
  });
}
