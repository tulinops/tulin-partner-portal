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
import { EstimateItemsBuilder } from "./estimate-items-builder";
import { SOLAR_BRANDS, type SolarBrandValue } from "@/lib/estimateBrands";
import { DEFAULT_ESTIMATE_TERMS } from "@/lib/estimateDefaults";

const STAGES = ["NEW", "CONTACTED", "SITE_VISIT", "QUOTED", "WON", "LOST"] as const;
const LINE_ITEM_ROW_COUNT = 8;

function defaultValidUntil() {
  return new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export default async function LeadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const lead = await getLead(id);
  if (!lead) notFound();

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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-extrabold">{lead.customerName}</h1>
          <p className="text-sm text-muted-foreground">
            {lead.phone} · {lead.source}
            {lead.email ? ` · ${lead.email}` : ""}
          </p>
        </div>
        <Badge variant={lead.stage === "WON" ? "default" : lead.stage === "LOST" ? "destructive" : "secondary"}>
          {lead.stage.replace("_", " ")}
        </Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Pipeline stage</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={moveStageAction} className="flex flex-wrap gap-2">
            {STAGES.map((stage) => (
              <Button
                key={stage}
                type="submit"
                name="stage"
                value={stage}
                variant={stage === lead.stage ? "default" : "outline"}
                size="sm"
              >
                {stage.replace("_", " ")}
              </Button>
            ))}
          </form>
        </CardContent>
      </Card>

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
              <Textarea id="leadAddress" name="address" defaultValue={lead.address ?? ""} placeholder="Customer address, shown on estimates" />
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
            <Button type="submit" size="sm">Save details</Button>
          </form>
        </CardContent>
      </Card>

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

            <EstimateItemsBuilder />

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="subsidyEstimate">Est. government subsidy (₹)</Label>
                <Input id="subsidyEstimate" name="subsidyEstimate" type="number" step="0.01" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="validUntil">Valid until</Label>
                <Input id="validUntil" name="validUntil" type="date" defaultValue={defaultValidUntil()} />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Terms &amp; conditions</Label>
              <Textarea id="notes" name="notes" defaultValue={DEFAULT_ESTIMATE_TERMS} rows={8} />
            </div>

            <Button type="submit">Create estimate</Button>
          </form>
        </CardContent>
      </Card>

      {lead.connection && (
        <Card>
          <CardHeader>
            <CardTitle>Customer</CardTitle>
          </CardHeader>
          <CardContent>
            <a href={`/admin/connections/${lead.connection.id}`} className="underline underline-offset-4">
              View customer →
            </a>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Notes &amp; follow-ups</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <form action={addNoteAction} className="space-y-2">
            <Textarea name="body" placeholder="Add a note..." required />
            <div className="flex items-center gap-2">
              <Label htmlFor="followUpAt" className="text-sm text-muted-foreground">
                Follow up on
              </Label>
              <Input id="followUpAt" name="followUpAt" type="date" className="w-auto" />
              <Button type="submit" size="sm">Add note</Button>
            </div>
          </form>
          <Separator />
          <div className="space-y-3">
            {lead.notes.map((note) => (
              <div key={note.id} className="text-sm">
                <p>{note.body}</p>
                <p className="text-xs text-muted-foreground">
                  {note.createdAt.toLocaleString()}
                  {note.followUpAt && ` · follow up ${note.followUpAt.toLocaleDateString()}`}
                </p>
              </div>
            ))}
            {lead.notes.length === 0 && (
              <p className="text-sm text-muted-foreground">No notes yet.</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
