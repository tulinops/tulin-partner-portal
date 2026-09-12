import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getConnectionDetail,
  recordPayment,
  updateConnectionStatus,
  assignSiteVisit,
  updateSiteVisitStatus,
  recordPropertyInspection,
  recordSiteVisitResult,
  updateDocumentVerification,
  updateSubsidyApplication,
  updateWarranty,
} from "@/server/connections";
import { listInventoryItems, allocateToConnection } from "@/server/inventory";
import { listStaffMembers } from "@/server/staff";
import { SitePhotos } from "./site-photos";
import type {
  SiteVisitStatus,
  SiteVisitResult,
  RoofType,
  RoofCondition,
  RoofAccess,
} from "@/generated/prisma/enums";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

const STATUSES = [
  "SITE_INSPECTION_PENDING",
  "SITE_INSPECTION_DONE",
  "SUBSIDY_APPLIED",
  "SUBSIDY_APPROVED",
  "INSTALLATION_IN_PROGRESS",
  "COMPLETED",
  "CANCELLED",
] as const;

const SUBSIDY_STATUSES = ["NOT_APPLIED", "APPLIED", "APPROVED", "REJECTED", "DISBURSED"] as const;

const SITE_VISIT_STATUSES = [
  "PENDING",
  "ASSIGNED",
  "SCHEDULED",
  "IN_PROGRESS",
  "COMPLETED",
  "RESCHEDULE_REQUESTED",
  "CANCELLED",
] as const;

const SITE_VISIT_RESULTS = [
  "SUITABLE",
  "SUITABLE_WITH_CONDITIONS",
  "NOT_SUITABLE",
  "REQUIRES_FURTHER_INSPECTION",
] as const;

const ROOF_TYPES = ["RCC", "TIN", "TILED", "OTHER"] as const;
const ROOF_CONDITIONS = ["GOOD", "NEEDS_REPAIR", "POOR"] as const;
const ROOF_ACCESS_OPTIONS = ["EASY", "LADDER_REQUIRED", "DIFFICULT"] as const;

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
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const detail = await getConnectionDetail(id);
  if (!detail) notFound();
  const { connection, amountCollected, allocatedCost, profit, documentsVerified, warrantyExpiryDate } = detail;
  const items = await listInventoryItems();
  const staff = await listStaffMembers();

  async function allocateAction(formData: FormData) {
    "use server";
    await allocateToConnection({
      connectionId: id,
      inventoryItemId: String(formData.get("inventoryItemId")),
      quantity: Number(formData.get("quantity")),
    });
  }

  async function recordPaymentAction(formData: FormData) {
    "use server";
    await recordPayment({
      connectionId: id,
      amount: Number(formData.get("amount")),
      note: String(formData.get("note") || "") || undefined,
    });
  }

  async function updateStatusAction(formData: FormData) {
    "use server";
    await updateConnectionStatus({
      connectionId: id,
      status: formData.get("status") as (typeof STATUSES)[number],
      assignedInstaller: String(formData.get("assignedInstaller") || "") || undefined,
    });
  }

  async function siteVisitAssignmentAction(formData: FormData) {
    "use server";
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
  }

  async function propertyInspectionAction(formData: FormData) {
    "use server";
    const roofType = String(formData.get("roofType") || "");
    const roofCondition = String(formData.get("roofCondition") || "");
    const roofAccess = String(formData.get("roofAccess") || "");
    const roofAreaSqft = formData.get("roofAreaSqft");
    await recordPropertyInspection({
      connectionId: id,
      roofType: roofType ? (roofType as RoofType) : undefined,
      roofCondition: roofCondition ? (roofCondition as RoofCondition) : undefined,
      roofAreaSqft: roofAreaSqft ? Number(roofAreaSqft) : undefined,
      shadowObstruction: String(formData.get("shadowObstruction") || "") || undefined,
      orientation: String(formData.get("orientation") || "") || undefined,
      roofAccess: roofAccess ? (roofAccess as RoofAccess) : undefined,
      electricalConnectionDetails: String(formData.get("electricalConnectionDetails") || "") || undefined,
      meterInformation: String(formData.get("meterInformation") || "") || undefined,
      otherSiteRequirements: String(formData.get("otherSiteRequirements") || "") || undefined,
    });
  }

  async function siteVisitResultAction(formData: FormData) {
    "use server";
    await recordSiteVisitResult({
      connectionId: id,
      result: formData.get("result") as SiteVisitResult,
      workerNotes: String(formData.get("workerNotes") || "") || undefined,
    });
  }

  async function documentVerificationAction(formData: FormData) {
    "use server";
    await updateDocumentVerification({
      connectionId: id,
      docIdProofVerified: formData.get("docIdProofVerified") === "on",
      docAddressProofVerified: formData.get("docAddressProofVerified") === "on",
      docElectricityBillVerified: formData.get("docElectricityBillVerified") === "on",
      docOwnershipVerified: formData.get("docOwnershipVerified") === "on",
      docBankPassbookVerified: formData.get("docBankPassbookVerified") === "on",
      documentNotes: String(formData.get("documentNotes") || "") || undefined,
    });
  }

  async function subsidyAction(formData: FormData) {
    "use server";
    const appliedAt = formData.get("subsidyAppliedAt");
    const approvedAt = formData.get("subsidyApprovedAt");
    const disbursedAt = formData.get("subsidyDisbursedAt");
    await updateSubsidyApplication({
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
  }

  async function warrantyAction(formData: FormData) {
    "use server";
    await updateWarranty({
      connectionId: id,
      warrantyStartDate: new Date(String(formData.get("warrantyStartDate"))),
      warrantyPeriodMonths: Number(formData.get("warrantyPeriodMonths")),
      warrantyNotes: String(formData.get("warrantyNotes") || "") || undefined,
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{connection.customerName}</h1>
          <p className="text-sm text-muted-foreground">
            {connection.phone} {connection.address ? `· ${connection.address}` : ""}
          </p>
          <Link
            href={`/admin/leads/${connection.leadId}`}
            className="text-xs underline underline-offset-4 text-muted-foreground"
          >
            ← Back to lead
          </Link>
        </div>
        <Badge variant={connection.status === "CANCELLED" ? "destructive" : connection.status === "COMPLETED" ? "default" : "secondary"}>
          {connection.status.replace(/_/g, " ")}
        </Badge>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Collected</CardTitle>
          </CardHeader>
          <CardContent className="text-xl font-semibold">{money(amountCollected)}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Allocated cost</CardTitle>
          </CardHeader>
          <CardContent className="text-xl font-semibold">{money(allocatedCost)}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Profit</CardTitle>
          </CardHeader>
          <CardContent className="text-xl font-semibold">{money(profit)}</CardContent>
        </Card>
      </div>

      {connection.lead.estimates.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Estimate history</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {connection.lead.estimates.map((e) => (
              <div key={e.id} className="flex items-center justify-between text-sm">
                <span>
                  {e.estimateNumber} (v{e.version}
                  {e.isCurrent && ", current"}) — ₹{Number(e.totalAmount).toLocaleString("en-IN")}
                </span>
                <Link href={`/admin/estimates/${e.id}`} className="underline underline-offset-4" target="_blank">
                  View / Print →
                </Link>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Status &amp; installer</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={updateStatusAction} className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select name="status" defaultValue={connection.status}>
                <SelectTrigger id="status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s.replace(/_/g, " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="assignedInstaller">Assigned installer</Label>
              <Input
                id="assignedInstaller"
                name="assignedInstaller"
                defaultValue={connection.assignedInstaller ?? ""}
              />
            </div>
            <div className="flex items-end">
              <Button type="submit">Update</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Site visit assignment
            <Badge variant="secondary">{connection.siteVisitStatus.replace(/_/g, " ")}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form action={siteVisitAssignmentAction} className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="staffMemberId">Worker</Label>
              <Select name="staffMemberId" defaultValue={connection.staffMemberId ?? undefined}>
                <SelectTrigger id="staffMemberId">
                  <SelectValue placeholder="Select a worker" />
                </SelectTrigger>
                <SelectContent>
                  {staff.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                      {s.phone ? ` (${s.phone})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="siteVisitStatus">Status</Label>
              <Select name="siteVisitStatus" defaultValue={connection.siteVisitStatus}>
                <SelectTrigger id="siteVisitStatus">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SITE_VISIT_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s.replace(/_/g, " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="siteVisitScheduledAt">Visit date &amp; time</Label>
              <Input
                id="siteVisitScheduledAt"
                name="siteVisitScheduledAt"
                type="datetime-local"
                defaultValue={datetimeLocalValue(connection.siteVisitScheduledAt)}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="siteVisitInstructions">Instructions for worker</Label>
              <Textarea
                id="siteVisitInstructions"
                name="siteVisitInstructions"
                defaultValue={connection.siteVisitInstructions ?? ""}
              />
            </div>
            <div>
              <Button type="submit">Save assignment</Button>
            </div>
          </form>
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
          <CardTitle>Property inspection</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={propertyInspectionAction} className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="roofType">Roof type</Label>
              <Select name="roofType" defaultValue={connection.roofType ?? undefined}>
                <SelectTrigger id="roofType">
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  {ROOF_TYPES.map((r) => (
                    <SelectItem key={r} value={r}>
                      {r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="roofCondition">Roof condition</Label>
              <Select name="roofCondition" defaultValue={connection.roofCondition ?? undefined}>
                <SelectTrigger id="roofCondition">
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  {ROOF_CONDITIONS.map((r) => (
                    <SelectItem key={r} value={r}>
                      {r.replace(/_/g, " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="roofAreaSqft">Available roof area (sq. ft)</Label>
              <Input
                id="roofAreaSqft"
                name="roofAreaSqft"
                type="number"
                step="0.01"
                defaultValue={connection.roofAreaSqft?.toString() ?? ""}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="shadowObstruction">Shadow / obstruction</Label>
              <Input id="shadowObstruction" name="shadowObstruction" defaultValue={connection.shadowObstruction ?? ""} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="orientation">Direction / orientation</Label>
              <Input id="orientation" name="orientation" defaultValue={connection.orientation ?? ""} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="roofAccess">Access to roof</Label>
              <Select name="roofAccess" defaultValue={connection.roofAccess ?? undefined}>
                <SelectTrigger id="roofAccess">
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  {ROOF_ACCESS_OPTIONS.map((r) => (
                    <SelectItem key={r} value={r}>
                      {r.replace(/_/g, " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="electricalConnectionDetails">Electrical connection details</Label>
              <Input
                id="electricalConnectionDetails"
                name="electricalConnectionDetails"
                defaultValue={connection.electricalConnectionDetails ?? ""}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="meterInformation">Meter information</Label>
              <Input id="meterInformation" name="meterInformation" defaultValue={connection.meterInformation ?? ""} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="otherSiteRequirements">Other requirements</Label>
              <Input
                id="otherSiteRequirements"
                name="otherSiteRequirements"
                defaultValue={connection.otherSiteRequirements ?? ""}
              />
            </div>
            <div className="sm:col-span-3">
              <Button type="submit">Save inspection details</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Site visit result</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={siteVisitResultAction} className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {SITE_VISIT_RESULTS.map((r) => (
                <Button
                  key={r}
                  type="submit"
                  name="result"
                  value={r}
                  variant={r === connection.siteVisitResult ? "default" : "outline"}
                  size="sm"
                >
                  {r.replace(/_/g, " ")}
                </Button>
              ))}
            </div>
            <div className="space-y-2">
              <Label htmlFor="workerNotes">Worker notes</Label>
              <Textarea id="workerNotes" name="workerNotes" defaultValue={connection.siteVisitWorkerNotes ?? ""} />
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Document verification
            <Badge variant={documentsVerified ? "default" : "secondary"}>
              {documentsVerified ? "All verified" : "Pending"}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form action={documentVerificationAction} className="space-y-3">
            {[
              ["docIdProofVerified", "ID proof", connection.docIdProofVerified],
              ["docAddressProofVerified", "Address proof", connection.docAddressProofVerified],
              ["docElectricityBillVerified", "Electricity bill", connection.docElectricityBillVerified],
              ["docOwnershipVerified", "Property ownership document", connection.docOwnershipVerified],
              ["docBankPassbookVerified", "Bank passbook (for subsidy disbursement)", connection.docBankPassbookVerified],
            ].map(([name, label, checked]) => (
              <div key={name as string} className="flex items-center gap-2">
                <Checkbox id={name as string} name={name as string} defaultChecked={checked as boolean} />
                <Label htmlFor={name as string} className="font-normal">
                  {label as string}
                </Label>
              </div>
            ))}
            <div className="space-y-2">
              <Label htmlFor="documentNotes">Notes</Label>
              <Textarea id="documentNotes" name="documentNotes" defaultValue={connection.documentNotes ?? ""} />
            </div>
            <Button type="submit" size="sm">Save documents</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Government subsidy application</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={subsidyAction} className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="subsidyScheme">Scheme</Label>
              <Input id="subsidyScheme" name="subsidyScheme" defaultValue={connection.subsidyScheme ?? ""} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="subsidyStatus">Status</Label>
              <Select name="subsidyStatus" defaultValue={connection.subsidyStatus}>
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
          </form>
        </CardContent>
      </Card>

      {items.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Allocate inventory</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={allocateAction} className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="inventoryItemId">Item</Label>
                <Select name="inventoryItemId" required>
                  <SelectTrigger id="inventoryItemId">
                    <SelectValue placeholder="Select item" />
                  </SelectTrigger>
                  <SelectContent>
                    {items.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.name} ({item.runningStock.toString()} {item.unit} available)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="quantity">Quantity</Label>
                <Input id="quantity" name="quantity" type="number" step="0.01" required />
              </div>
              <div className="flex items-end">
                <Button type="submit">Allocate</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Record customer payment</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={recordPaymentAction} className="grid gap-4 sm:grid-cols-3">
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
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            Warranty
            {warrantyExpiryDate && (
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                Expires {warrantyExpiryDate.toLocaleDateString("en-IN")}
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form action={warrantyAction} className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="warrantyStartDate">Warranty start date</Label>
              <Input
                id="warrantyStartDate"
                name="warrantyStartDate"
                type="date"
                defaultValue={dateInputValue(connection.warrantyStartDate)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="warrantyPeriodMonths">Period (months)</Label>
              <Input
                id="warrantyPeriodMonths"
                name="warrantyPeriodMonths"
                type="number"
                defaultValue={connection.warrantyPeriodMonths?.toString() ?? ""}
                required
              />
            </div>
            <div className="flex items-end">
              <Button type="submit">Save warranty</Button>
            </div>
            <div className="space-y-2 sm:col-span-3">
              <Label htmlFor="warrantyNotes">Notes</Label>
              <Textarea id="warrantyNotes" name="warrantyNotes" defaultValue={connection.warrantyNotes ?? ""} />
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Inventory used</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item</TableHead>
                <TableHead>Quantity</TableHead>
                <TableHead>Unit cost</TableHead>
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
                  </TableRow>
                ))}
              {connection.inventoryTxns.filter((t) => t.type === "ALLOCATION").length === 0 && (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-muted-foreground">
                    No inventory allocated yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
