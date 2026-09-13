import Link from "next/link";
import { cn } from "cn";
import {
  createEstimate,
  duplicateEstimate,
  deleteEstimate,
  updateEstimateStatus,
  updateEstimateFields,
  scheduleSiteVisit,
  type EstimateLineItem,
  type getLead,
} from "@/server/leads";
import { EstimateBuilderWithPreview, DEFAULT_ROWS } from "./estimate-builder-with-preview";
import { SOLAR_BRANDS, type SolarBrandValue } from "@/lib/estimateBrands";
import { DEFAULT_ESTIMATE_TERMS } from "@/lib/estimateDefaults";
import { isEstimateLocked, STAGE_ORDER, type ConnectionStageKey } from "@/lib/connectionStage";
import type { EstimateStatus } from "@/generated/prisma/enums";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type LeadWithEstimates = NonNullable<Awaited<ReturnType<typeof getLead>>>;
export type EstimateRecord = LeadWithEstimates["estimates"][number];

const ESTIMATE_LINE_ITEM_ROW_COUNT = 20;

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Draft",
  SENT: "Sent to Customer",
  ACCEPTED: "Approved",
  REJECTED: "Rejected",
  LOCKED: "Locked",
};
const SELECTABLE_STATUSES = ["DRAFT", "SENT", "ACCEPTED", "LOCKED"] as const;

function defaultValidUntil() {
  return new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function parseLineItemsFromForm(formData: FormData): EstimateLineItem[] {
  const lineItems: EstimateLineItem[] = [];
  for (let i = 0; i < ESTIMATE_LINE_ITEM_ROW_COUNT; i++) {
    const description = String(formData.get(`item_${i}_description`) || "");
    if (!description.trim()) continue;
    lineItems.push({
      description,
      spec: String(formData.get(`item_${i}_spec`) || ""),
      qty: Number(formData.get(`item_${i}_qty`) || 0),
      rate: Number(formData.get(`item_${i}_rate`) || 0),
      amount: 0, // recomputed server-side
    });
  }
  return lineItems;
}

function parseBrandFromForm(formData: FormData): SolarBrandValue | undefined {
  const rawBrand = String(formData.get("brand") || "");
  return SOLAR_BRANDS.some((b) => b.value === rawBrand) ? (rawBrand as SolarBrandValue) : undefined;
}

/**
 * The one Estimate tab shared by the Lead page and the Connection/Customer
 * page — previously each page grew its own copy of this and they drifted
 * out of sync (missing live totals, missing add-item, etc). Multiple
 * quotations can coexist per lead; only one (isCurrent) is ever the final,
 * approved quote.
 */
export async function EstimateWorkflowSection({
  leadId,
  estimates,
  activeEstimateId,
  connectionStage,
  hasConnection,
  basePath,
  customerName,
  phone,
  email,
  address,
  tenantName,
  tenantAddress,
  tenantGstin,
  tenantPhone,
  tenantEmail,
}: {
  leadId: string;
  estimates: EstimateRecord[];
  activeEstimateId?: string;
  connectionStage: ConnectionStageKey | null;
  hasConnection: boolean;
  basePath: string;
  customerName: string;
  phone: string;
  email?: string | null;
  address?: string | null;
  tenantName: string;
  tenantAddress?: string | null;
  tenantGstin?: string | null;
  tenantPhone?: string | null;
  tenantEmail?: string | null;
}) {
  async function newQuotationAction() {
    "use server";
    await createEstimate({
      leadId,
      lineItems: DEFAULT_ROWS.map((r) => ({ ...r, amount: 0 })),
    });
  }

  if (estimates.length === 0) {
    return (
      <div className="rounded-md border border-dashed p-6 text-center">
        <p className="mb-3 text-sm text-muted-foreground">No quotations yet.</p>
        <form action={newQuotationAction}>
          <Button type="submit" size="sm">
            + Create first quotation
          </Button>
        </form>
      </div>
    );
  }

  // Rendered oldest-first regardless of the query's own ordering, so quote
  // tabs read left-to-right as v1, v2, v3...
  const sorted = [...estimates].sort((a, b) => a.version - b.version);
  const finalEstimate = sorted.find((e) => e.isCurrent);
  const active =
    sorted.find((e) => e.id === activeEstimateId) ?? finalEstimate ?? sorted[sorted.length - 1];
  const isActiveFinal = finalEstimate?.id === active.id;

  const locked = isEstimateLocked({
    status: active.status,
    isCurrent: active.isCurrent,
    hasOtherFinalEstimate: !!finalEstimate && !isActiveFinal,
    connectionStage,
  });

  const stageAdvanced = connectionStage !== null && STAGE_ORDER.indexOf(connectionStage) >= STAGE_ORDER.indexOf("subsidyloan");

  async function duplicateAction() {
    "use server";
    await duplicateEstimate(active.id);
  }

  async function deleteAction() {
    "use server";
    await deleteEstimate(active.id);
  }

  async function statusAction(formData: FormData) {
    "use server";
    await updateEstimateStatus(active.id, formData.get("status") as EstimateStatus);
  }

  async function scheduleSiteVisitAction() {
    "use server";
    await scheduleSiteVisit(leadId);
  }

  async function saveFieldsAction(formData: FormData) {
    "use server";
    const systemSizeKw = formData.get("systemSizeKw");
    const gstPercent = formData.get("gstPercent");
    const subsidyEstimate = formData.get("subsidyEstimate");
    const validUntil = formData.get("validUntil");
    await updateEstimateFields(active.id, {
      systemSizeKw: systemSizeKw ? Number(systemSizeKw) : undefined,
      brand: parseBrandFromForm(formData),
      lineItems: parseLineItemsFromForm(formData),
      gstPercent: gstPercent ? Number(gstPercent) : undefined,
      subsidyEstimate: subsidyEstimate ? Number(subsidyEstimate) : undefined,
      validUntil: validUntil ? new Date(String(validUntil)) : undefined,
      notes: String(formData.get("notes") || "") || undefined,
    });
  }

  const activeLineItems = (active.lineItems as unknown as EstimateLineItem[] | null) ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-1 border-b border-border">
        {sorted.map((e) => (
          <Link
            key={e.id}
            href={`${basePath}?quote=${e.id}`}
            className={cn(
              "shrink-0 rounded-t-md border border-b-0 px-3 py-1.5 text-xs font-semibold whitespace-nowrap",
              e.id === active.id
                ? "border-border bg-card text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            v{e.version}
            {e.isCurrent && " · ✓ Final"}
          </Link>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="font-mono text-xs text-muted-foreground">{active.estimateNumber}</span>
          <Badge variant={active.isCurrent ? "default" : "secondary"}>{STATUS_LABELS[active.status] ?? active.status}</Badge>
          {locked && <Badge variant="outline">Locked</Badge>}
        </div>
        <div className="flex flex-wrap gap-2">
          <form action={newQuotationAction}>
            <Button type="submit" variant="outline" size="sm">
              + New
            </Button>
          </form>
          <form action={duplicateAction}>
            <Button type="submit" variant="outline" size="sm">
              Duplicate
            </Button>
          </form>
          {estimates.length > 1 && (
            <form action={deleteAction}>
              <Button type="submit" variant="outline" size="sm" className="text-destructive">
                Delete
              </Button>
            </form>
          )}
          <Link href={`/admin/estimates/${active.id}`} target="_blank">
            <Button type="button" variant="outline" size="sm">
              View / Print →
            </Button>
          </Link>
        </div>
      </div>

      {stageAdvanced && (
        <p className="rounded-md bg-muted p-3 text-sm text-muted-foreground">
          This lead has moved into Subsidy / Loan processing or later — quotations are frozen and can no
          longer be changed.
        </p>
      )}

      <form action={statusAction} className="flex flex-wrap items-end gap-2">
        <div className="space-y-1">
          <Select name="status" defaultValue={active.status} disabled={stageAdvanced}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SELECTABLE_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {STATUS_LABELS[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button type="submit" size="sm" disabled={stageAdvanced}>
          Update status
        </Button>
      </form>

      <form action={saveFieldsAction} className="space-y-4">
        <EstimateBuilderWithPreview
          customerName={customerName}
          phone={phone}
          email={email}
          address={address}
          tenantName={tenantName}
          tenantAddress={tenantAddress}
          tenantGstin={tenantGstin}
          tenantPhone={tenantPhone}
          tenantEmail={tenantEmail}
          defaultValidUntil={active.validUntil ? active.validUntil.toISOString().slice(0, 10) : defaultValidUntil()}
          initialCapacity={active.systemSizeKw ? Number(active.systemSizeKw) : undefined}
          initialBrand={(active.brand as SolarBrandValue | undefined) ?? undefined}
          initialRows={activeLineItems.map((item) => ({
            description: item.description,
            spec: item.spec ?? "",
            qty: item.qty,
            rate: item.rate,
          }))}
          initialGstPercent={Number(active.gstPercent)}
          initialSubsidyEstimate={active.subsidyEstimate ? Number(active.subsidyEstimate) : undefined}
          initialNotes={active.notes ?? DEFAULT_ESTIMATE_TERMS}
          locked={locked}
        />
        {!locked && <Button type="submit">Save changes</Button>}
      </form>

      {isActiveFinal && !hasConnection && (connectionStage === "lead" || connectionStage === "estimate" || connectionStage === null) && (
        <form action={scheduleSiteVisitAction}>
          <Button type="submit">Schedule site visit →</Button>
        </form>
      )}
    </div>
  );
}
