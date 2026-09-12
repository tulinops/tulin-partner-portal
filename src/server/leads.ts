"use server";

import { revalidatePath } from "next/cache";
import { getTenantDb } from "@/lib/tenantDb";
import type { LeadSource, LeadStage } from "@/generated/prisma/enums";

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
    include: { notes: { orderBy: { createdAt: "desc" } }, connection: true },
  });
}

export async function createLead(input: {
  customerName: string;
  phone: string;
  source: LeadSource;
  estimatedValue?: number;
}) {
  const { db, tenantId } = await getTenantDb();
  await db.lead.create({
    data: {
      tenantId,
      customerName: input.customerName,
      phone: input.phone,
      source: input.source,
      estimatedValue: input.estimatedValue,
    },
  });
  revalidatePath("/admin/leads");
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
