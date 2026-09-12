"use server";

import { revalidatePath } from "next/cache";
import { getTenantDb } from "@/lib/tenantDb";
import type { LeadSource, LeadStage, EstimateStatus } from "@/generated/prisma/enums";

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
  requirementNotes?: string;
}) {
  const { db } = await getTenantDb();
  const lead = await db.lead.findFirst({ where: { id: input.leadId } });
  if (!lead) throw new Error("Lead not found");

  await db.lead.update({
    where: { id: input.leadId },
    data: { email: input.email, requirementNotes: input.requirementNotes },
  });
  revalidatePath(`/admin/leads/${input.leadId}`);
}

export async function moveLeadStage(leadId: string, stage: LeadStage) {
  const { db } = await getTenantDb();
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
  qty: number;
  rate: number;
  amount: number;
};

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
  return `${tenantSlug.toUpperCase()}/${fiscalYear}/${stamp}`;
}

export async function createEstimate(input: {
  leadId: string;
  systemSizeKw?: number;
  lineItems: EstimateLineItem[];
  gstPercent?: number;
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
    .map((li) => ({ ...li, amount: li.qty * li.rate }));
  const subtotal = items.reduce((sum, li) => sum + li.amount, 0);
  const gstPercent = input.gstPercent ?? 0;
  const gstAmount = subtotal * (gstPercent / 100);
  const totalAmount = subtotal + gstAmount;
  const estimateNumber = await generateEstimateNumber(tenant.slug);

  await db.$transaction(async (tx) => {
    const prior = await tx.estimate.count({ where: { leadId: input.leadId } });
    await tx.estimate.updateMany({
      where: { leadId: input.leadId },
      data: { isCurrent: false },
    });
    await tx.estimate.create({
      data: {
        tenantId,
        leadId: input.leadId,
        estimateNumber,
        version: prior + 1,
        isCurrent: true,
        systemSizeKw: input.systemSizeKw,
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
  });

  revalidatePath(`/admin/leads/${input.leadId}`);
}

export async function updateEstimateStatus(estimateId: string, status: EstimateStatus) {
  const { db } = await getTenantDb();
  const estimate = await db.estimate.findFirst({ where: { id: estimateId } });
  if (!estimate) throw new Error("Estimate not found");

  await db.estimate.update({ where: { id: estimateId }, data: { status } });
  revalidatePath(`/admin/leads/${estimate.leadId}`);
  revalidatePath(`/admin/estimates/${estimateId}`);
}

export async function getEstimate(estimateId: string) {
  const { db } = await getTenantDb();
  return db.estimate.findFirst({
    where: { id: estimateId },
    include: { lead: true, tenant: true },
  });
}

export async function convertLeadToConnection(input: {
  leadId: string;
  address?: string;
  systemSizeKw?: number;
}) {
  const { db, tenantId } = await getTenantDb();
  const lead = await db.lead.findFirst({ where: { id: input.leadId } });
  if (!lead) throw new Error("Lead not found");

  await db.$transaction(async (tx) => {
    await tx.lead.update({ where: { id: lead.id }, data: { stage: "WON" } });
    await tx.connection.create({
      data: {
        tenantId,
        leadId: lead.id,
        customerName: lead.customerName,
        phone: lead.phone,
        address: input.address,
        systemSizeKw: input.systemSizeKw,
      },
    });
  });

  revalidatePath("/admin/leads");
  revalidatePath("/admin/connections");
}
