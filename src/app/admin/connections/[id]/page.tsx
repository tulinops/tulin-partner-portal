import Link from "next/link";
import { notFound } from "next/navigation";
import { X } from "lucide-react";
import {
  getConnectionDetail,
  recordPayment,
  assignSiteVisit,
  updateSiteVisitStatus,
  recordSiteInspectionDetails,
  recordSiteVisitResult,
  updateSubsidyApplication,
  createLoanApplication,
  updateLoanApplication,
  updateInstallationStatus,
  updateInstalledEquipment,
  recordInstallationSignOff,
  createWarrantyRecord,
  deleteWarrantyRecord,
  type SiteInspectionDetails,
  type InstalledEquipmentItem,
} from "@/server/connections";
import { isInspectionComplete, areRequiredSitePhotosComplete } from "@/lib/siteVisitReadiness";
import { ensureConnectionDocuments } from "@/server/documents";
import { listInventoryItems } from "@/server/inventory";
import { listStaffMembers } from "@/server/staff";
import { addLeadNote, type EstimateLineItem } from "@/server/leads";
import { getBusinessProfile } from "@/server/business-profile";
import { SitePhotos } from "./site-photos";
import { SiteVisitAssignmentFields } from "./site-visit-assignment-fields";
import { SiteVisitDetailsFields } from "./site-visit-details-fields";
import { DocumentRow } from "./document-row";
import { CustomerTabs } from "./customer-tabs";
import { InstalledEquipmentEditor } from "./installed-equipment-editor";
import { FinancingMethodSelect } from "./financing-method-select";
import { WarrantyRecordForm } from "./warranty-record-form";
import { AddWarrantyDialog } from "./add-warranty-dialog";
import { WarrantyRecordView } from "./warranty-record-view";
import { EditWarrantyDialog } from "./edit-warranty-dialog";
import { InvoiceItemsEditor } from "./invoice-items-editor";
import { generateInvoice, updateInvoice, completeInvoice, type InvoiceLineItem } from "@/server/invoices";
import { EstimateWorkflowSection } from "@/app/admin/leads/[id]/estimate-workflow-section";
import { STAGE_LABELS, STAGE_ORDER } from "@/lib/connectionStage";
import { buildEquipmentFromEstimateLineItems } from "@/lib/installationEquipment";
import { brandLabel } from "@/lib/estimateBrands";
import type {
  SiteVisitStatus,
  SiteVisitResult,
  LoanStatus,
  InstallationStatus,
  EquipmentType,
  WarrantyType,
} from "@/generated/prisma/enums";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { StatusBadge, CONNECTION_STATUS_TONE } from "@/components/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/PageHeader";
import { ActionForm } from "@/components/action-form";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { asActionResult } from "@/lib/actionResult";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const SUBSIDY_STATUSES = ["NOT_APPLIED", "APPLIED", "APPROVED", "REJECTED", "DISBURSED"] as const;

const LOAN_STATUSES = [
  "APPLICATION_PENDING",
  "UNDER_REVIEW",
  "APPROVED",
  "REJECTED",
  "DISBURSED",
  "COMPLETED",
] as const;

const INSTALLATION_STATUSES = [
  "PENDING",
  "SCHEDULED",
  "TEAM_ASSIGNED",
  "IN_PROGRESS",
  "INSPECTION_PENDING",
  "COMPLETED",
] as const;

// Fallback only — the form always sends the real row count via a hidden
// "equipCount" field, since "+ Add item" can push rows past any fixed guess.
const EQUIPMENT_ROW_COUNT_FALLBACK = 20;

// Same fallback pattern as EQUIPMENT_ROW_COUNT_FALLBACK, for the Invoice
// items editor's own hidden "itemCount" field.
const INVOICE_ROW_COUNT_FALLBACK = 20;

function parseInvoiceLineItemsFromForm(formData: FormData): InvoiceLineItem[] {
  const rowCount = Number(formData.get("itemCount")) || INVOICE_ROW_COUNT_FALLBACK;
  const items: InvoiceLineItem[] = [];
  for (let i = 0; i < rowCount; i++) {
    const description = String(formData.get(`item_${i}_description`) || "");
    if (!description.trim()) continue;
    items.push({
      description,
      spec: String(formData.get(`item_${i}_spec`) || ""),
      brand: String(formData.get(`item_${i}_brand`) || "") || undefined,
      qty: Number(formData.get(`item_${i}_qty`) || 0),
      rate: Number(formData.get(`item_${i}_rate`) || 0),
      gstPercent: Number(formData.get(`item_${i}_gstPercent`) || 0),
      amount: 0, // recomputed server-side
    });
  }
  return items;
}

function datetimeLocalValue(d: Date | null | undefined) {
  return d ? new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16) : "";
}

function money(n: number) {
  return `₹${n.toLocaleString("en-IN")}`;
}

function dateInputValue(d: Date | null | undefined) {
  return d ? d.toISOString().slice(0, 10) : "";
}

export default async function ConnectionDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ quote?: string }>;
}) {
  const { id } = await params;
  const { quote: activeEstimateId } = await searchParams;
  await ensureConnectionDocuments(id);
  const detail = await getConnectionDetail(id);
  if (!detail) notFound();
  const {
    connection,
    amountCollected,
    documentsVerified,
    currentLoanApplication,
    loanPendingAmount,
    warrantyRecordsWithExpiry,
    siteInspectionDetails,
    installedEquipment,
    stage,
  } = detail;
  const items = await listInventoryItems();
  // Decimal -> number so this can cross the server/client boundary as a
  // plain prop into InstalledEquipmentEditor.
  const inventoryItemOptions = items.map((item) => ({
    id: item.id,
    name: item.name,
    unit: item.unit,
    runningStock: Number(item.runningStock),
  }));
  const staff = await listStaffMembers();
  const tenant = await getBusinessProfile();
  const inspection = siteInspectionDetails ?? ({} as SiteInspectionDetails);
  const sitePhotosComplete = areRequiredSitePhotosComplete(connection.sitePhotos);
  const canCompleteSiteVisit = isInspectionComplete(siteInspectionDetails) && sitePhotosComplete;

  async function recordPaymentAction(formData: FormData) {
    "use server";
    return asActionResult(() =>
      recordPayment({
        connectionId: id,
        amount: Number(formData.get("amount")),
        note: String(formData.get("note") || "") || undefined,
      }),
    );
  }

  async function siteVisitAssignmentAction(formData: FormData) {
    "use server";
    return asActionResult(async () => {
      const scheduledAt = formData.get("siteVisitScheduledAt");
      await assignSiteVisit({
        connectionId: id,
        staffMemberId: String(formData.get("staffMemberId") || "") || undefined,
        scheduledAt: scheduledAt ? new Date(String(scheduledAt)) : undefined,
        instructions: String(formData.get("siteVisitInstructions") || "") || undefined,
      });
      await updateSiteVisitStatus({
        connectionId: id,
        status: formData.get("siteVisitStatus") as SiteVisitStatus,
      });
    });
  }

  // One combined save for the merged "Property inspection & site visit
  // result" card — inspection details are written first so the result save
  // (which requires inspection + required photos to already be complete)
  // sees the just-saved values rather than racing against them.
  async function siteVisitDetailsAction(formData: FormData) {
    "use server";
    return asActionResult(async () => {
      const roofAreaSqft = formData.get("roofAreaSqft");
      const details: SiteInspectionDetails = {
        roofType: String(formData.get("roofType") || "") || undefined,
        roofCondition: String(formData.get("roofCondition") || "") || undefined,
        roofAreaSqft: roofAreaSqft ? Number(roofAreaSqft) : undefined,
        shadowObstruction: String(formData.get("shadowObstruction") || "") || undefined,
        orientation: String(formData.get("orientation") || "") || undefined,
        roofAccess: String(formData.get("roofAccess") || "") || undefined,
        electricalConnectionDetails: String(formData.get("electricalConnectionDetails") || "") || undefined,
        meterInformation: String(formData.get("meterInformation") || "") || undefined,
        otherRequirements: String(formData.get("otherRequirements") || "") || undefined,
      };
      await recordSiteInspectionDetails({ connectionId: id, details });
      await recordSiteVisitResult({
        connectionId: id,
        result: formData.get("result") as SiteVisitResult,
        workerNotes: String(formData.get("workerNotes") || "") || undefined,
      });
    });
  }

  async function subsidyAction(formData: FormData) {
    "use server";
    return asActionResult(() => {
      const appliedAt = formData.get("subsidyAppliedAt");
      const approvedAt = formData.get("subsidyApprovedAt");
      const disbursedAt = formData.get("subsidyDisbursedAt");
      return updateSubsidyApplication({
        connectionId: id,
        subsidyScheme: String(formData.get("subsidyScheme") || "") || undefined,
        subsidyApplicationRefNo: String(formData.get("subsidyApplicationRefNo") || "") || undefined,
        subsidyAppliedAmount: formData.get("subsidyAppliedAmount")
          ? Number(formData.get("subsidyAppliedAmount"))
          : undefined,
        subsidyApprovedAmount: formData.get("subsidyApprovedAmount")
          ? Number(formData.get("subsidyApprovedAmount"))
          : undefined,
        subsidyStatus: formData.get("subsidyStatus") as (typeof SUBSIDY_STATUSES)[number],
        subsidyAppliedAt: appliedAt ? new Date(String(appliedAt)) : undefined,
        subsidyApprovedAt: approvedAt ? new Date(String(approvedAt)) : undefined,
        subsidyDisbursedAt: disbursedAt ? new Date(String(disbursedAt)) : undefined,
      });
    });
  }

  async function loanApplicationAction(formData: FormData) {
    "use server";
    return asActionResult(() => {
      const applicationDate = formData.get("applicationDate");
      return createLoanApplication({
        connectionId: id,
        bankName: String(formData.get("bankName")),
        applicationNumber: String(formData.get("applicationNumber") || "") || undefined,
        loanAmount: Number(formData.get("loanAmount")),
        applicationDate: applicationDate ? new Date(String(applicationDate)) : undefined,
      });
    });
  }

  async function loanUpdateAction(formData: FormData) {
    "use server";
    return asActionResult(() => {
      const sanctionedAt = formData.get("sanctionedAt");
      const disbursedAt = formData.get("disbursedAt");
      const paymentReceivedAt = formData.get("paymentReceivedByProprietorAt");
      return updateLoanApplication({
        id: String(formData.get("loanId")),
        status: formData.get("status") as LoanStatus,
        sanctionedAt: sanctionedAt ? new Date(String(sanctionedAt)) : undefined,
        sanctionedAmount: formData.get("sanctionedAmount") ? Number(formData.get("sanctionedAmount")) : undefined,
        disbursedAmount: formData.get("disbursedAmount") ? Number(formData.get("disbursedAmount")) : undefined,
        disbursedAt: disbursedAt ? new Date(String(disbursedAt)) : undefined,
        paymentReceivedByProprietorAmount: formData.get("paymentReceivedByProprietorAmount")
          ? Number(formData.get("paymentReceivedByProprietorAmount"))
          : undefined,
        paymentReceivedByProprietorAt: paymentReceivedAt ? new Date(String(paymentReceivedAt)) : undefined,
        paymentReference: String(formData.get("paymentReference") || "") || undefined,
        notes: String(formData.get("loanNotes") || "") || undefined,
      });
    });
  }

  async function installationStatusAction(formData: FormData) {
    "use server";
    return asActionResult(() =>
      updateInstallationStatus({
        connectionId: id,
        status: formData.get("installationStatus") as InstallationStatus,
      }),
    );
  }

  async function installedEquipmentAction(formData: FormData) {
    "use server";
    return asActionResult(() => {
      const rowCount = Number(formData.get("equipCount")) || EQUIPMENT_ROW_COUNT_FALLBACK;
      const items: InstalledEquipmentItem[] = [];
      for (let i = 0; i < rowCount; i++) {
        const type = String(formData.get(`equip_${i}_type`) || "");
        if (!type) continue;
        items.push({
          type: type as EquipmentType,
          brand: String(formData.get(`equip_${i}_brand`) || "") || undefined,
          model: String(formData.get(`equip_${i}_model`) || "") || undefined,
          serialNumber: String(formData.get(`equip_${i}_serial`) || "") || undefined,
          quantity: Number(formData.get(`equip_${i}_qty`) || 1),
          inventoryItemId: String(formData.get(`equip_${i}_inventoryItemId`) || "") || undefined,
        });
      }
      return updateInstalledEquipment({ connectionId: id, items });
    });
  }

  async function signOffAction(formData: FormData) {
    "use server";
    return asActionResult(() =>
      recordInstallationSignOff({
        connectionId: id,
        signedOffByName: String(formData.get("signedOffByName")),
        notes: String(formData.get("installationNotes") || "") || undefined,
      }),
    );
  }

  async function generateInvoiceAction() {
    "use server";
    return asActionResult(() => generateInvoice(id));
  }

  async function updateInvoiceAction(formData: FormData) {
    "use server";
    if (!connection.invoice) return;
    return asActionResult(() => {
      const invoiceDate = formData.get("invoiceDate");
      return updateInvoice(connection.invoice!.id, {
        lineItems: parseInvoiceLineItemsFromForm(formData),
        invoiceDate: invoiceDate ? new Date(String(invoiceDate)) : undefined,
        notes: String(formData.get("notes") || "") || undefined,
      });
    });
  }

  async function completeInvoiceAction() {
    "use server";
    if (!connection.invoice) return;
    return asActionResult(() => completeInvoice(connection.invoice!.id));
  }

  async function warrantyCreateAction(formData: FormData) {
    "use server";
    return asActionResult(() =>
      createWarrantyRecord({
        connectionId: id,
        equipmentType: formData.get("equipmentType") as EquipmentType,
        productName: String(formData.get("productName")),
        manufacturer: String(formData.get("manufacturer") || "") || undefined,
        model: String(formData.get("model") || "") || undefined,
        serialNumber: String(formData.get("serialNumber") || "") || undefined,
        warrantyType: (formData.get("warrantyType") as WarrantyType) || undefined,
        startDate: new Date(String(formData.get("startDate"))),
        periodMonths: Number(formData.get("periodMonths")),
        terms: String(formData.get("terms") || "") || undefined,
      }),
    );
  }

  async function warrantyDeleteAction(formData: FormData) {
    "use server";
    return asActionResult(() =>
      deleteWarrantyRecord({
        id: String(formData.get("id")),
        connectionId: id,
      }),
    );
  }

  async function addNoteAction(formData: FormData) {
    "use server";
    return asActionResult(() => {
      const followUpAt = formData.get("followUpAt");
      return addLeadNote({
        leadId: connection.leadId,
        body: String(formData.get("body")),
        followUpAt: followUpAt ? new Date(String(followUpAt)) : undefined,
      });
    });
  }

  const finalEstimate = connection.lead.estimates.find((e) => e.isCurrent);

  // A Connection's computed stage is never "lead"/"estimate" — those two are
  // always already behind it (see computeConnectionStage's own doc comment)
  // — but every ConnectionStageKey is listed for type-safety.
  const STAGE_META: Record<(typeof STAGE_ORDER)[number], { pending: string; next: string }> = {
    lead: { pending: "", next: "" },
    estimate: { pending: "", next: "" },
    sitevisit: {
      pending: "Site visit scheduled — awaiting the result.",
      next: "Record the site visit result, then start document collection.",
    },
    documents: {
      pending: "Chase the customer for any pending documents.",
      next: "Once all documents are verified, move to Payments.",
    },
    subsidyloan: {
      pending: "Subsidy / loan application in progress.",
      next: "Once financing is settled, schedule the installation.",
    },
    installation: {
      pending: "Installation scheduled or in progress.",
      next: "Complete the installation and get customer sign-off.",
    },
    completed: {
      pending: "Awaiting warranty record creation.",
      next: "Warranty starts automatically once installation is marked complete.",
    },
    warranty: {
      pending: "None — job complete, warranty is active.",
      next: "Monitor for any service requests.",
    },
  };
  let stageMeta = STAGE_META[stage];
  if (stage === "sitevisit" && connection.siteVisitResult === "NOT_SUITABLE") {
    stageMeta = { pending: "Site visit marked Not Suitable.", next: "Close this lead — it will not proceed to installation." };
  } else if (stage === "sitevisit" && connection.siteVisitResult === "REQUIRES_FURTHER_INSPECTION") {
    stageMeta = { pending: "Site visit flagged for further inspection.", next: "Schedule a follow-up visit before moving to Documents." };
  }
  const completedSteps = STAGE_ORDER.slice(0, STAGE_ORDER.indexOf(stage)).map((s) => STAGE_LABELS[s]);
  const estimateTotal = finalEstimate ? Number(finalEstimate.totalAmount) : null;
  const estimateSubsidy = finalEstimate ? Number(finalEstimate.subsidyEstimate ?? 0) : 0;
  const netDue = (estimateTotal ?? 0) - estimateSubsidy;
  // Prefer the real tracked subsidy figures on the Payments tab (approved,
  // then applied) once they exist — they're more authoritative than the
  // estimate's original placeholder figure from before the application
  // actually started.
  const subsidyAmount =
    connection.subsidyApprovedAmount != null
      ? Number(connection.subsidyApprovedAmount)
      : connection.subsidyAppliedAmount != null
        ? Number(connection.subsidyAppliedAmount)
        : finalEstimate?.subsidyEstimate != null
          ? Number(finalEstimate.subsidyEstimate)
          : null;
  const paymentStatus =
    amountCollected <= 0
      ? "₹0 collected yet"
      : amountCollected >= netDue
        ? `Fully collected (${money(amountCollected)})`
        : `Partially collected (${money(amountCollected)})`;

  const overviewSection = (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>At a glance</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
          <div>
            <p className="text-muted-foreground">Current stage</p>
            <p className="font-medium">{STAGE_LABELS[stage]}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Completed steps</p>
            <p className="font-medium">{completedSteps.length ? completedSteps.join(" → ") : "None yet"}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Pending action</p>
            <p className="font-medium">{stageMeta.pending}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Next step</p>
            <p className="font-medium">{stageMeta.next}</p>
          </div>
          <div>
            <p className="text-muted-foreground">System size</p>
            <p className="font-medium">{finalEstimate ? `${Number(finalEstimate.systemSizeKw)} kW` : "—"}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Estimate total</p>
            <p className="font-medium">{estimateTotal !== null ? money(estimateTotal) : "—"}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Payment status</p>
            <p className="font-medium">{paymentStatus}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Installation status</p>
            <p className="font-medium">{connection.installationStatus.replace(/_/g, " ")}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Warranty status</p>
            <p className="font-medium">
              {warrantyRecordsWithExpiry.length
                ? `Active — ${warrantyRecordsWithExpiry.length} record${warrantyRecordsWithExpiry.length > 1 ? "s" : ""}`
                : "Not yet created"}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">Assigned worker</p>
            <p className="font-medium">{connection.staffMember?.name ?? "Not assigned"}</p>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Customer payment</CardTitle>
          </CardHeader>
          <CardContent className="font-mono text-xl font-semibold">{money(amountCollected)}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Subsidy amount</CardTitle>
          </CardHeader>
          <CardContent className="font-mono text-xl font-semibold">
            {subsidyAmount !== null ? money(subsidyAmount) : "—"}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total amount</CardTitle>
          </CardHeader>
          <CardContent className="font-mono text-xl font-semibold">
            {estimateTotal !== null ? money(estimateTotal) : "—"}
          </CardContent>
        </Card>
      </div>
    </div>
  );

  const leadSection = (
    <Card>
      <CardHeader>
        <CardTitle>Lead details</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-muted-foreground">Customer name</p>
            <p className="font-medium">{connection.lead.customerName}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Phone</p>
            <p className="font-mono font-medium">{connection.lead.phone}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Email</p>
            <p className="font-medium">{connection.lead.email ?? "—"}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Source</p>
            <p className="font-medium">{connection.lead.source}</p>
          </div>
          <div className="sm:col-span-2">
            <p className="text-muted-foreground">Address</p>
            <p className="font-medium">{connection.lead.address ?? "—"}</p>
          </div>
        </div>
        <div>
          <p className="text-muted-foreground">Customer requirements</p>
          <p className="font-medium">{connection.lead.requirementNotes ?? "—"}</p>
        </div>
        <Link
          href={`/admin/leads/${connection.leadId}`}
          className="inline-block text-xs text-muted-foreground underline underline-offset-4"
        >
          Edit from the Leads section →
        </Link>
      </CardContent>
    </Card>
  );

  const estimateSection = (
    <Card>
      <CardHeader>
        <CardTitle>Estimate</CardTitle>
      </CardHeader>
      <CardContent>
        <EstimateWorkflowSection
          leadId={connection.leadId}
          estimates={connection.lead.estimates}
          activeEstimateId={activeEstimateId}
          connectionStage={stage}
          basePath={`/admin/connections/${id}`}
          customerName={connection.lead.customerName}
          phone={connection.lead.phone}
          email={connection.lead.email}
          address={connection.lead.address}
          tenantName={tenant?.name ?? "Your Business"}
          tenantAddress={tenant?.businessAddress}
          tenantGstin={tenant?.gstin}
          tenantPhone={tenant?.contactPhone}
          tenantEmail={tenant?.contactEmail}
        />
      </CardContent>
    </Card>
  );

  const siteVisitSection = (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Site visit assignment
            <Badge variant="secondary">{connection.siteVisitStatus.replace(/_/g, " ")}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ActionForm action={siteVisitAssignmentAction} successMessage="Site visit assignment saved" className="grid gap-4 sm:grid-cols-2">
            <SiteVisitAssignmentFields
              key={connection.updatedAt.getTime()}
              staff={staff}
              initialStaffMemberId={connection.staffMemberId}
              initialStatus={connection.siteVisitStatus}
              initialScheduledAt={datetimeLocalValue(connection.siteVisitScheduledAt)}
              initialInstructions={connection.siteVisitInstructions ?? ""}
              canCompleteSiteVisit={canCompleteSiteVisit}
            />
          </ActionForm>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Site photos</CardTitle>
        </CardHeader>
        <CardContent>
          <SitePhotos connectionId={id} photos={connection.sitePhotos} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Property inspection &amp; site visit result</CardTitle>
        </CardHeader>
        <CardContent>
          <ActionForm
            action={siteVisitDetailsAction}
            successMessage="Site visit details saved"
            className="space-y-6"
          >
            <SiteVisitDetailsFields
              key={connection.updatedAt.getTime()}
              initialDetails={inspection}
              currentResult={connection.siteVisitResult}
              initialWorkerNotes={connection.siteVisitWorkerNotes ?? ""}
              photosComplete={sitePhotosComplete}
            />
          </ActionForm>
        </CardContent>
      </Card>
    </div>
  );

  const documentsSection = (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Document verification
          <Badge variant={documentsVerified ? "default" : "secondary"}>
            {documentsVerified ? "All verified" : "Pending"}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div
          className={
            documentsVerified
              ? "rounded-md bg-primary/10 p-3 text-sm font-medium text-primary"
              : "rounded-md bg-amber-100 p-3 text-sm font-medium text-amber-900 dark:bg-amber-950/60 dark:text-amber-200"
          }
        >
          {documentsVerified
            ? "All documents verified — ready to move this customer to Payments."
            : `${connection.connectionDocuments.filter((d) => d.status === "VERIFIED").length} / ${connection.connectionDocuments.length} documents verified — uploading a file is not enough on its own. Review the uploaded file, then set each document's status to "Verified" and Save, to move this customer forward.`}
        </div>
        <p className="text-xs text-muted-foreground">
          Manage the required-document list from{" "}
          <Link href="/admin/settings/documents" className="underline underline-offset-4">
            Business Profile
          </Link>
          .
        </p>
        {connection.connectionDocuments.map((doc) => (
          <DocumentRow key={doc.id} doc={doc} />
        ))}
        {connection.connectionDocuments.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No required document types configured yet — add some from Business Profile.
          </p>
        )}
      </CardContent>
    </Card>
  );

  const subsidyLoanReached = STAGE_ORDER.indexOf(stage) >= STAGE_ORDER.indexOf("subsidyloan");
  const subsidyLoanSection = (
    <div className="space-y-6">
      <div
        className={
          !subsidyLoanReached
            ? "rounded-md bg-amber-100 p-3 text-sm font-medium text-amber-900 dark:bg-amber-950/60 dark:text-amber-200"
            : stage === "subsidyloan"
              ? "rounded-md bg-amber-100 p-3 text-sm font-medium text-amber-900 dark:bg-amber-950/60 dark:text-amber-200"
              : "rounded-md bg-primary/10 p-3 text-sm font-medium text-primary"
        }
      >
        {!subsidyLoanReached
          ? `This customer hasn't reached Payments yet — the current stage is still "${STAGE_LABELS[stage]}". Anything saved here is kept, but won't count as progress until that catches up.`
          : stage === "subsidyloan"
            ? connection.financingMethod === "LOAN"
              ? 'Financing isn\'t settled yet — set the loan status to "Completed" below to move this customer to Installation.'
              : 'Financing isn\'t settled yet — set the subsidy status to "Disbursed" below to move this customer to Installation. (Only the Bank loan financing method has a "Completed" status — full-payment customers settle at "Disbursed".)'
            : "Financing settled — this customer has moved to Installation."}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Record customer payment</CardTitle>
        </CardHeader>
        <CardContent>
          <ActionForm action={recordPaymentAction} successMessage="Payment recorded" className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="amount">Amount (₹)</Label>
              <Input id="amount" name="amount" type="number" step="0.01" required />
            </div>
            <div className="space-y-2 sm:col-span-1">
              <Label htmlFor="note">Note (optional)</Label>
              <Input id="note" name="note" />
            </div>
            <div className="flex items-end">
              <Button type="submit">Record payment</Button>
            </div>
          </ActionForm>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>How is the customer paying?</CardTitle>
        </CardHeader>
        <CardContent>
          <FinancingMethodSelect connectionId={id} initialValue={connection.financingMethod} />
        </CardContent>
      </Card>

      {connection.financingMethod !== "LOAN" && (
        <Card>
          <CardHeader>
            <CardTitle>Government subsidy application</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-4 text-sm text-muted-foreground">
              Tracking-only — this is credited by the government directly to the customer&apos;s own bank account, never
              to us. Never sum this into revenue.
            </p>
            <ActionForm action={subsidyAction} successMessage="Subsidy application saved" className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="subsidyScheme">Scheme</Label>
                <Input id="subsidyScheme" name="subsidyScheme" defaultValue={connection.subsidyScheme ?? ""} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="subsidyStatus">Status</Label>
                <Select
                  key={connection.updatedAt.getTime()}
                  name="subsidyStatus"
                  defaultValue={connection.subsidyStatus}
                >
                  <SelectTrigger id="subsidyStatus">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SUBSIDY_STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s.replace(/_/g, " ")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="subsidyApplicationRefNo">Application ref. no.</Label>
                <Input
                  id="subsidyApplicationRefNo"
                  name="subsidyApplicationRefNo"
                  defaultValue={connection.subsidyApplicationRefNo ?? ""}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="subsidyAppliedAmount">Applied amount (₹)</Label>
                <Input
                  id="subsidyAppliedAmount"
                  name="subsidyAppliedAmount"
                  type="number"
                  step="0.01"
                  defaultValue={connection.subsidyAppliedAmount?.toString() ?? ""}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="subsidyApprovedAmount">Approved amount (₹)</Label>
                <Input
                  id="subsidyApprovedAmount"
                  name="subsidyApprovedAmount"
                  type="number"
                  step="0.01"
                  defaultValue={connection.subsidyApprovedAmount?.toString() ?? ""}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="subsidyAppliedAt">Applied on</Label>
                <Input
                  id="subsidyAppliedAt"
                  name="subsidyAppliedAt"
                  type="date"
                  defaultValue={dateInputValue(connection.subsidyAppliedAt)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="subsidyApprovedAt">Approved on</Label>
                <Input
                  id="subsidyApprovedAt"
                  name="subsidyApprovedAt"
                  type="date"
                  defaultValue={dateInputValue(connection.subsidyApprovedAt)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="subsidyDisbursedAt">Disbursed on</Label>
                <Input
                  id="subsidyDisbursedAt"
                  name="subsidyDisbursedAt"
                  type="date"
                  defaultValue={dateInputValue(connection.subsidyDisbursedAt)}
                />
              </div>
              <div className="flex items-end">
                <Button type="submit">Save subsidy application</Button>
              </div>
            </ActionForm>
          </CardContent>
        </Card>
      )}

      {connection.financingMethod === "LOAN" && (
        <Card>
          <CardHeader>
            <CardTitle>Bank loan</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {currentLoanApplication ? (
              <>
                <div className="grid gap-1 text-sm">
                  <p>
                    <span className="text-muted-foreground">Bank:</span> {currentLoanApplication.bankName}
                    {currentLoanApplication.applicationNumber ? ` · ${currentLoanApplication.applicationNumber}` : ""}
                  </p>
                  <p>
                    <span className="text-muted-foreground">Loan amount:</span>{" "}
                    {money(Number(currentLoanApplication.loanAmount))}
                  </p>
                  {loanPendingAmount !== null && (
                    <p>
                      <span className="text-muted-foreground">Pending from bank:</span> {money(loanPendingAmount)}
                    </p>
                  )}
                </div>
                <ActionForm action={loanUpdateAction} successMessage="Loan application updated" className="grid gap-4 sm:grid-cols-3">
                  <input type="hidden" name="loanId" value={currentLoanApplication.id} />
                  <div className="space-y-2">
                    <Label htmlFor="loanStatus">Status</Label>
                    {/* Keyed so a reapplication (a new LoanApplication
                        replacing the current one in this same slot) forces a
                        remount — same stale-uncontrolled-Select issue fixed
                        for the Estimate status dropdown. */}
                    <Select
                      key={currentLoanApplication.id}
                      name="status"
                      defaultValue={currentLoanApplication.status}
                    >
                      <SelectTrigger id="loanStatus">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {LOAN_STATUSES.map((s) => (
                          <SelectItem key={s} value={s}>
                            {s.replace(/_/g, " ")}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="sanctionedAmount">Sanctioned amount (₹)</Label>
                    <Input
                      id="sanctionedAmount"
                      name="sanctionedAmount"
                      type="number"
                      step="0.01"
                      defaultValue={currentLoanApplication.sanctionedAmount?.toString() ?? ""}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="sanctionedAt">Sanctioned on</Label>
                    <Input
                      id="sanctionedAt"
                      name="sanctionedAt"
                      type="date"
                      defaultValue={dateInputValue(currentLoanApplication.sanctionedAt)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="disbursedAmount">Disbursed amount (₹)</Label>
                    <Input
                      id="disbursedAmount"
                      name="disbursedAmount"
                      type="number"
                      step="0.01"
                      defaultValue={currentLoanApplication.disbursedAmount?.toString() ?? ""}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="disbursedAt">Disbursed on</Label>
                    <Input
                      id="disbursedAt"
                      name="disbursedAt"
                      type="date"
                      defaultValue={dateInputValue(currentLoanApplication.disbursedAt)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="paymentReceivedByProprietorAmount">Received by us (₹)</Label>
                    <Input
                      id="paymentReceivedByProprietorAmount"
                      name="paymentReceivedByProprietorAmount"
                      type="number"
                      step="0.01"
                      defaultValue={currentLoanApplication.paymentReceivedByProprietorAmount?.toString() ?? ""}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="paymentReceivedByProprietorAt">Received on</Label>
                    <Input
                      id="paymentReceivedByProprietorAt"
                      name="paymentReceivedByProprietorAt"
                      type="date"
                      defaultValue={dateInputValue(currentLoanApplication.paymentReceivedByProprietorAt)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="paymentReference">Payment reference</Label>
                    <Input
                      id="paymentReference"
                      name="paymentReference"
                      defaultValue={currentLoanApplication.paymentReference ?? ""}
                    />
                  </div>
                  <div className="space-y-2 sm:col-span-3">
                    <Label htmlFor="loanNotes">Notes</Label>
                    <Textarea id="loanNotes" name="loanNotes" defaultValue={currentLoanApplication.notes ?? ""} />
                  </div>
                  <div>
                    <Button type="submit">Save</Button>
                  </div>
                </ActionForm>
              </>
            ) : (
              <ActionForm action={loanApplicationAction} successMessage="Loan application created" className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="bankName">Bank / NBFC</Label>
                  <Input id="bankName" name="bankName" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="applicationNumber">Application no.</Label>
                  <Input id="applicationNumber" name="applicationNumber" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="loanAmount">Loan amount (₹)</Label>
                  <Input id="loanAmount" name="loanAmount" type="number" step="0.01" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="applicationDate">Application date</Label>
                  <Input id="applicationDate" name="applicationDate" type="date" />
                </div>
                <div className="flex items-end">
                  <Button type="submit">Create loan application</Button>
                </div>
              </ActionForm>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );

  // Pre-fill from the approved quotation only while nothing has been saved
  // yet — once the installer saves anything, that's what future loads show,
  // never silently overwritten by the quotation again. estimateEquipmentItems
  // is also handed to the editor directly so its "Refill from estimate"
  // button can pull the quotation in on demand even after that point.
  const finalEstimateLineItems = (finalEstimate?.lineItems as unknown as EstimateLineItem[] | null) ?? [];
  const estimateEquipmentItems = buildEquipmentFromEstimateLineItems(
    finalEstimateLineItems,
    brandLabel(finalEstimate?.brand),
  );
  const equipmentInitialRows = installedEquipment.length > 0 ? installedEquipment : estimateEquipmentItems;

  const installationSection = (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Installation</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <ActionForm action={installationStatusAction} successMessage="Installation status saved" className="flex flex-wrap items-end gap-4">
            <div className="space-y-2">
              <Label htmlFor="installationStatus">Status</Label>
              {/* Keyed so this re-syncs after recordInstallationSignOff sets
                  installationStatus to COMPLETED as a side effect of the
                  separate sign-off form below — same stale-Select issue as
                  the site visit status dropdown. */}
              <Select
                key={connection.updatedAt.getTime()}
                name="installationStatus"
                defaultValue={connection.installationStatus}
              >
                <SelectTrigger id="installationStatus" className="w-56">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {INSTALLATION_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s.replace(/_/g, " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button type="submit">Save status</Button>
          </ActionForm>

          <div>
            <p className="mb-2 text-sm font-medium">Installed equipment</p>
            <ActionForm action={installedEquipmentAction} successMessage="Installed equipment saved" className="space-y-2">
              {/* Forces a remount after every save so edits (brand, serial
                  numbers, etc.) don't look like they vanished — same
                  stale-client-state issue fixed for the Estimate/Invoice editors. */}
              <InstalledEquipmentEditor
                key={connection.updatedAt.getTime()}
                initialItems={equipmentInitialRows}
                estimateItems={estimateEquipmentItems}
                inventoryItems={inventoryItemOptions}
              />
              <Button type="submit" size="sm">
                Save
              </Button>
            </ActionForm>
          </div>

          <ActionForm action={signOffAction} successMessage="Installation signed off" className="grid gap-4 border-t pt-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="signedOffByName">Signed off by</Label>
              <Input
                id="signedOffByName"
                name="signedOffByName"
                defaultValue={connection.installationSignedOffByName ?? ""}
                placeholder="Customer's name"
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="installationNotes">Notes</Label>
              <Textarea id="installationNotes" name="installationNotes" defaultValue={connection.installationNotes ?? ""} />
            </div>
            <div>
              <Button type="submit">Mark installation complete</Button>
            </div>
            {connection.installationSignedOffAt && (
              <p className="text-xs text-muted-foreground sm:col-span-3">
                Signed off {connection.installationSignedOffAt.toLocaleDateString("en-IN")}. Completing this
                auto-creates warranty records from the equipment list, using sensible default periods you can edit.
              </p>
            )}
          </ActionForm>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Inventory used</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-xs text-muted-foreground">
            Deducted automatically from each installed-equipment row&apos;s matched inventory item when installation
            is signed off.
          </p>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item</TableHead>
                <TableHead>Quantity used</TableHead>
                <TableHead>Unit cost</TableHead>
                <TableHead>Left over</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {connection.inventoryTxns
                .filter((t) => t.type === "ALLOCATION")
                .map((t) => (
                  <TableRow key={t.id}>
                    <TableCell>{t.inventoryItem.name}</TableCell>
                    <TableCell>{t.quantity.toString()}</TableCell>
                    <TableCell>{money(Number(t.unitCost ?? 0))}</TableCell>
                    <TableCell>
                      {t.inventoryItem.runningStock.toString()} {t.inventoryItem.unit}
                    </TableCell>
                  </TableRow>
                ))}
              {connection.inventoryTxns.filter((t) => t.type === "ALLOCATION").length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">
                    No inventory used yet — signs off happen from the Installation status form above.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );

  const invoiceLineItems = (
    (connection.invoice?.lineItems as unknown as InvoiceLineItem[] | null) ?? []
  ).map((item) => ({
    ...item,
    // Older invoices saved before per-item GST existed fall back to the
    // invoice's own (then-flat) GST% rather than 0.
    gstPercent: item.gstPercent ?? Number(connection.invoice?.gstPercent ?? 0),
  }));
  const invoiceLocked = connection.invoice?.status === "COMPLETE";
  const invoiceSection = (
    <Card>
      <CardHeader>
        <CardTitle>Invoice</CardTitle>
      </CardHeader>
      <CardContent>
        {!connection.invoice ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              No invoice yet. Generating one copies the customer&apos;s actual installed equipment into a billable
              invoice — not the original quotation — so it reflects anything added on-site. It&apos;s editable
              until marked complete.
            </p>
            <ActionForm action={generateInvoiceAction} successMessage="Invoice generated">
              <Button type="submit">Generate invoice</Button>
            </ActionForm>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-muted-foreground">{connection.invoice.invoiceNumber}</span>
                <StatusBadge tone={invoiceLocked ? "done" : "neutral"} label={invoiceLocked ? "Complete" : "Draft"} />
              </div>
              <div className="flex flex-wrap gap-2">
                {!invoiceLocked && (
                  <ActionForm action={completeInvoiceAction} successMessage="Invoice marked complete">
                    <ConfirmSubmitButton
                      type="submit"
                      variant="outline"
                      size="sm"
                      confirmMessage="Mark this invoice complete? It can no longer be edited afterward."
                    >
                      Mark complete
                    </ConfirmSubmitButton>
                  </ActionForm>
                )}
                <Link href={`/admin/invoices/${connection.invoice.id}`} target="_blank">
                  <Button type="button" variant="outline" size="sm">
                    View / Print →
                  </Button>
                </Link>
              </div>
            </div>
            <ActionForm action={updateInvoiceAction} successMessage="Invoice updated" className="space-y-4">
              <fieldset disabled={invoiceLocked} className="space-y-4 disabled:opacity-60">
                <div className="space-y-2 sm:w-64">
                  <Label htmlFor="invoiceDate">Invoice date</Label>
                  <Input
                    id="invoiceDate"
                    name="invoiceDate"
                    type="date"
                    defaultValue={connection.invoice.invoiceDate.toISOString().slice(0, 10)}
                  />
                </div>
                {/* Forces a remount after every save (updatedAt changes on
                    write) — otherwise React reuses the same instance and its
                    internal row state never re-syncs with the freshly saved
                    data, making edits (brand included) look like they vanished. */}
                <InvoiceItemsEditor
                  key={connection.invoice.updatedAt.getTime()}
                  initialItems={invoiceLineItems}
                />
                <div className="space-y-2">
                  <Label htmlFor="notes">Terms &amp; conditions</Label>
                  <Textarea id="notes" name="notes" defaultValue={connection.invoice.notes ?? ""} rows={6} />
                </div>
              </fieldset>
              {!invoiceLocked && <Button type="submit">Save changes</Button>}
            </ActionForm>
          </div>
        )}
      </CardContent>
    </Card>
  );

  const warrantySection = (
    <Card>
      <CardHeader>
        <CardTitle>Warranty</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Product</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Manufacturer / Model / Serial</TableHead>
              <TableHead>Warranty</TableHead>
              <TableHead>Expires</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {warrantyRecordsWithExpiry.map((w) => (
              <TableRow key={w.id}>
                <TableCell className="font-medium">{w.productName}</TableCell>
                <TableCell>{w.equipmentType.replace(/_/g, " ")}</TableCell>
                <TableCell className="text-muted-foreground">
                  {[w.manufacturer, w.model, w.serialNumber].filter(Boolean).join(" · ") || "—"}
                </TableCell>
                <TableCell>
                  {w.warrantyType.replace(/_/g, " ")} · {w.periodMonths}mo
                </TableCell>
                <TableCell>{w.expiryDate.toLocaleDateString("en-IN")}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <WarrantyRecordView
                      record={{
                        productName: w.productName,
                        equipmentType: w.equipmentType,
                        manufacturer: w.manufacturer,
                        model: w.model,
                        serialNumber: w.serialNumber,
                        warrantyType: w.warrantyType,
                        periodMonths: w.periodMonths,
                        startDate: w.startDate.toLocaleDateString("en-IN"),
                        expiryDate: w.expiryDate.toLocaleDateString("en-IN"),
                        terms: w.terms,
                      }}
                    />
                    <EditWarrantyDialog
                      record={{
                        id: w.id,
                        connectionId: id,
                        equipmentType: w.equipmentType,
                        productName: w.productName,
                        manufacturer: w.manufacturer,
                        model: w.model,
                        serialNumber: w.serialNumber,
                        warrantyType: w.warrantyType,
                        startDate: dateInputValue(w.startDate),
                        periodMonths: w.periodMonths,
                        terms: w.terms,
                      }}
                    />
                    <ActionForm action={warrantyDeleteAction} successMessage="Warranty record deleted">
                      <input type="hidden" name="id" value={w.id} />
                      <ConfirmSubmitButton
                        type="submit"
                        variant="ghost"
                        size="icon-sm"
                        className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                        title={`Delete ${w.productName}`}
                        confirmMessage={`Delete the warranty record for "${w.productName}"? This can't be undone.`}
                      >
                        <X />
                      </ConfirmSubmitButton>
                    </ActionForm>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {warrantyRecordsWithExpiry.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  No warranty records yet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>

        <AddWarrantyDialog key={warrantyRecordsWithExpiry.length}>
          <ActionForm action={warrantyCreateAction} successMessage="Warranty record added" className="space-y-4">
            <WarrantyRecordForm installedEquipment={installedEquipment} />
            <Button type="submit">Add warranty record</Button>
          </ActionForm>
        </AddWarrantyDialog>
      </CardContent>
    </Card>
  );

  const activitySection = (
    <Card>
      <CardHeader>
        <CardTitle>Activity &amp; notes</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <ActionForm action={addNoteAction} successMessage="Note added" className="space-y-2">
          <Textarea name="body" placeholder="Add a note..." required />
          <div className="flex items-center gap-2">
            <Label htmlFor="followUpAt" className="text-sm text-muted-foreground">
              Follow up on
            </Label>
            <Input id="followUpAt" name="followUpAt" type="date" className="w-auto" />
            <Button type="submit" size="sm">
              Add note
            </Button>
          </div>
        </ActionForm>
        <div className="space-y-3 border-t pt-4">
          {connection.lead.notes.map((note) => (
            <div key={note.id} className="text-sm">
              <p>{note.body}</p>
              <p className="text-xs text-muted-foreground">
                {note.createdAt.toLocaleString()}
                {note.followUpAt && ` · follow up ${note.followUpAt.toLocaleDateString()}`}
              </p>
            </div>
          ))}
          {connection.lead.notes.length === 0 && <p className="text-sm text-muted-foreground">No notes yet.</p>}
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={[{ label: "Connections", href: "/admin/connections" }, { label: connection.customerName }]}
        eyebrow={`Customer #${connection.id.slice(-6).toUpperCase()}`}
        title={connection.customerName}
        description={
          <>
            <span className="font-mono font-semibold text-foreground">{connection.phone}</span>
            <span>
              Lead source: <span className="font-semibold text-foreground">{connection.lead.source}</span>
            </span>
          </>
        }
        actions={<StatusBadge tone={CONNECTION_STATUS_TONE[connection.status]} label={STAGE_LABELS[stage]} />}
      />

      <CustomerTabs
        currentStage={stage}
        overview={overviewSection}
        lead={leadSection}
        estimate={estimateSection}
        sitevisit={siteVisitSection}
        documents={documentsSection}
        subsidyloan={subsidyLoanSection}
        installation={installationSection}
        invoice={invoiceSection}
        warranty={warrantySection}
        activity={activitySection}
      />
    </div>
  );
}
