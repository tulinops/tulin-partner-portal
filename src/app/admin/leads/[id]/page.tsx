import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getLead,
  moveLeadStage,
  addLeadNote,
  updateLeadDetails,
  createEstimate,
  type EstimateLineItem,
} from "@/server/leads";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EstimateBuilderWithPreview } from "./estimate-builder-with-preview";
import { CustomerTabs } from "@/app/admin/connections/[id]/customer-tabs";
import { SOLAR_BRANDS, type SolarBrandValue } from "@/lib/estimateBrands";
import { DEFAULT_ESTIMATE_TERMS } from "@/lib/estimateDefaults";
import { getBusinessProfile } from "@/server/business-profile";

const STAGES = ["NEW", "CONTACTED", "SITE_VISIT", "QUOTED", "WON", "LOST"] as const;
const LINE_ITEM_ROW_COUNT = 8;

function defaultValidUntil() {
  return new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

const NOT_YET_A_CUSTOMER = (
  <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
    Available once this lead becomes a customer — mark the pipeline stage <strong>Won</strong> above to start
    the customer journey.
  </p>
);

export default async function LeadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const lead = await getLead(id);
  if (!lead) notFound();
  const tenant = await getBusinessProfile();

  const currentEstimate = lead.estimates.find((e) => e.isCurrent);
  const stage = currentEstimate ? "estimate" : "lead";

  async function moveStageAction(formData: FormData) {
    "use server";
    await moveLeadStage(id, formData.get("stage") as (typeof STAGES)[number]);
  }

  async function addNoteAction(formData: FormData) {
    "use server";
    const followUpAt = formData.get("followUpAt");
    await addLeadNote({
      leadId: id,
      body: String(formData.get("body")),
      followUpAt: followUpAt ? new Date(String(followUpAt)) : undefined,
    });
  }

  async function updateDetailsAction(formData: FormData) {
    "use server";
    await updateLeadDetails({
      leadId: id,
      email: String(formData.get("email") || "") || undefined,
      address: String(formData.get("address") || "") || undefined,
      requirementNotes: String(formData.get("requirementNotes") || "") || undefined,
    });
  }

  async function createEstimateAction(formData: FormData) {
    "use server";
    const lineItems: EstimateLineItem[] = [];
    for (let i = 0; i < LINE_ITEM_ROW_COUNT; i++) {
      const description = String(formData.get(`item_${i}_description`) || "");
      if (!description.trim()) continue;
      lineItems.push({
        description,
        spec: String(formData.get(`item_${i}_spec`) || ""),
        qty: Number(formData.get(`item_${i}_qty`) || 0),
        rate: Number(formData.get(`item_${i}_rate`) || 0),
        amount: 0, // recomputed server-side in createEstimate
      });
    }

    const systemSizeKw = formData.get("systemSizeKw");
    const gstPercent = formData.get("gstPercent");
    const subsidyEstimate = formData.get("subsidyEstimate");
    const validUntil = formData.get("validUntil");
    // FormData is untrusted input — validate against the known brand list
    // before it reaches a typed Prisma enum column.
    const rawBrand = String(formData.get("brand") || "");
    const brand = SOLAR_BRANDS.some((b) => b.value === rawBrand) ? (rawBrand as SolarBrandValue) : undefined;

    await createEstimate({
      leadId: id,
      systemSizeKw: systemSizeKw ? Number(systemSizeKw) : undefined,
      brand,
      lineItems,
      gstPercent: gstPercent ? Number(gstPercent) : undefined,
      subsidyEstimate: subsidyEstimate ? Number(subsidyEstimate) : undefined,
      validUntil: validUntil ? new Date(String(validUntil)) : undefined,
      notes: String(formData.get("notes") || "") || undefined,
    });
  }

  const overviewSection = (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Pipeline stage</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={moveStageAction} className="flex flex-wrap gap-2">
            {STAGES.map((s) => (
              <Button
                key={s}
                type="submit"
                name="stage"
                value={s}
                variant={s === lead.stage ? "default" : "outline"}
                size="sm"
              >
                {s.replace("_", " ")}
              </Button>
            ))}
          </form>
          <p className="mt-2 text-xs text-muted-foreground">
            Marking a lead <strong>Won</strong> automatically creates its customer record.
          </p>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Estimated value</CardTitle>
          </CardHeader>
          <CardContent className="font-mono text-xl font-semibold">
            {lead.estimatedValue ? `₹${Number(lead.estimatedValue).toLocaleString("en-IN")}` : "—"}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Current estimate total</CardTitle>
          </CardHeader>
          <CardContent className="font-mono text-xl font-semibold">
            {currentEstimate ? `₹${Number(currentEstimate.totalAmount).toLocaleString("en-IN")}` : "—"}
          </CardContent>
        </Card>
      </div>

      {lead.requirementNotes && (
        <Card>
          <CardHeader>
            <CardTitle>Customer requirement</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground italic">&ldquo;{lead.requirementNotes}&rdquo;</p>
          </CardContent>
        </Card>
      )}
    </div>
  );

  const leadSection = (
    <Card>
      <CardHeader>
        <CardTitle>Lead details</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={updateDetailsAction} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" defaultValue={lead.email ?? ""} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="leadAddress">Address</Label>
            <Textarea
              id="leadAddress"
              name="address"
              defaultValue={lead.address ?? ""}
              placeholder="Customer address, shown on estimates"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="requirementNotes">Customer requirements</Label>
            <Textarea
              id="requirementNotes"
              name="requirementNotes"
              defaultValue={lead.requirementNotes ?? ""}
              placeholder="What the customer is asking for (roof type, monthly bill, budget, etc.)"
            />
          </div>
          <Button type="submit" size="sm">
            Save details
          </Button>
        </form>
      </CardContent>
    </Card>
  );

  const estimateSection = (
    <Card>
      <CardHeader>
        <CardTitle>Estimates</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>No.</TableHead>
              <TableHead>Version</TableHead>
              <TableHead>Total</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Created</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {lead.estimates.map((e) => (
              <TableRow key={e.id}>
                <TableCell>{e.estimateNumber}</TableCell>
                <TableCell>
                  v{e.version}
                  {e.isCurrent && <Badge className="ml-2">current</Badge>}
                </TableCell>
                <TableCell>₹{Number(e.totalAmount).toLocaleString("en-IN")}</TableCell>
                <TableCell>{e.status}</TableCell>
                <TableCell>{e.createdAt.toLocaleDateString("en-IN")}</TableCell>
                <TableCell>
                  <Link href={`/admin/estimates/${e.id}`} className="underline underline-offset-4" target="_blank">
                    View / Print →
                  </Link>
                </TableCell>
              </TableRow>
            ))}
            {lead.estimates.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  No estimates yet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>

        <Separator />

        <form action={createEstimateAction} className="space-y-4">
          <h3 className="text-sm font-semibold">Create new estimate</h3>

          <EstimateBuilderWithPreview
            customerName={lead.customerName}
            phone={lead.phone}
            email={lead.email}
            address={lead.address}
            tenantName={tenant?.name ?? "Your Business"}
            tenantAddress={tenant?.businessAddress}
            tenantGstin={tenant?.gstin}
            tenantPhone={tenant?.contactPhone}
            tenantEmail={tenant?.contactEmail}
            defaultValidUntil={defaultValidUntil()}
            initialNotes={DEFAULT_ESTIMATE_TERMS}
          />

          <Button type="submit">Create estimate</Button>
        </form>
      </CardContent>
    </Card>
  );

  const activitySection = (
    <Card>
      <CardHeader>
        <CardTitle>Activity &amp; notes</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <form action={addNoteAction} className="space-y-2">
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
        </form>
        <div className="space-y-3 border-t pt-4">
          {lead.notes.map((note) => (
            <div key={note.id} className="text-sm">
              <p>{note.body}</p>
              <p className="text-xs text-muted-foreground">
                {note.createdAt.toLocaleString()}
                {note.followUpAt && ` · follow up ${note.followUpAt.toLocaleDateString()}`}
              </p>
            </div>
          ))}
          {lead.notes.length === 0 && <p className="text-sm text-muted-foreground">No notes yet.</p>}
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="font-heading text-xs font-semibold tracking-wide text-primary uppercase">
            Lead #{lead.id.slice(-6).toUpperCase()}
          </p>
          <h1 className="font-heading text-2xl font-extrabold">{lead.customerName}</h1>
          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
            <span className="font-mono font-semibold text-foreground">{lead.phone}</span>
            <span>
              Source: <span className="font-semibold text-foreground">{lead.source}</span>
            </span>
            {lead.email && <span>{lead.email}</span>}
          </div>
        </div>
        {lead.connection ? (
          <Link href={`/admin/connections/${lead.connection.id}`}>
            <Button variant="outline" size="sm">
              View customer →
            </Button>
          </Link>
        ) : (
          <Badge variant={lead.stage === "LOST" ? "destructive" : "secondary"}>{lead.stage.replace("_", " ")}</Badge>
        )}
      </div>

      <CustomerTabs
        currentStage={stage}
        overview={overviewSection}
        lead={leadSection}
        estimate={estimateSection}
        sitevisit={NOT_YET_A_CUSTOMER}
        documents={NOT_YET_A_CUSTOMER}
        subsidyloan={NOT_YET_A_CUSTOMER}
        installation={NOT_YET_A_CUSTOMER}
        warranty={NOT_YET_A_CUSTOMER}
        activity={activitySection}
      />
    </div>
  );
}
