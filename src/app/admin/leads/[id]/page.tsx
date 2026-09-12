import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getLead,
  moveLeadStage,
  addLeadNote,
  convertLeadToConnection,
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

const STAGES = ["NEW", "CONTACTED", "SITE_VISIT", "QUOTED", "WON", "LOST"] as const;

// Default line-item categories, mirroring tulin-solar's quotation.html brand
// template — the Admin fills in specification/qty/rate, blank rows are
// dropped server-side.
const LINE_ITEM_DEFAULTS = [
  { description: "Solar PV Module", spec: "" },
  { description: "Solar Inverter", spec: "" },
  { description: "Solar Mounting Structure", spec: "Hot Dip Galvanized / Aluminium Structure" },
  { description: "DC Solar Cable", spec: "UV Resistant DC Solar Cable" },
  { description: "AC Cable", spec: "Copper / Aluminium AC Cable" },
  { description: "MC4 Connectors", spec: "Original Compatible MC4 Connectors" },
  { description: "Earthing & Lightning Protection", spec: "Complete Earthing & Lightning Protection System" },
  { description: "Installation & Commissioning", spec: "Complete Solar System Installation & Commissioning" },
];

export default async function LeadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const lead = await getLead(id);
  if (!lead) notFound();

  const currentEstimate = lead.estimates.find((e) => e.isCurrent);

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

  async function convertAction(formData: FormData) {
    "use server";
    const systemSizeKw = formData.get("systemSizeKw");
    await convertLeadToConnection({
      leadId: id,
      address: String(formData.get("address") || ""),
      systemSizeKw: systemSizeKw ? Number(systemSizeKw) : undefined,
    });
  }

  async function updateDetailsAction(formData: FormData) {
    "use server";
    await updateLeadDetails({
      leadId: id,
      email: String(formData.get("email") || "") || undefined,
      requirementNotes: String(formData.get("requirementNotes") || "") || undefined,
    });
  }

  async function createEstimateAction(formData: FormData) {
    "use server";
    const lineItems: EstimateLineItem[] = [];
    for (let i = 0; i < LINE_ITEM_DEFAULTS.length; i++) {
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

    await createEstimate({
      leadId: id,
      systemSizeKw: systemSizeKw ? Number(systemSizeKw) : undefined,
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
          <h1 className="text-2xl font-semibold">{lead.customerName}</h1>
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
            <div className="grid gap-4 sm:grid-cols-4">
              <div className="space-y-2">
                <Label htmlFor="systemSizeKw">System size (kW)</Label>
                <Input id="systemSizeKw" name="systemSizeKw" type="number" step="0.1" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="gstPercent">GST (%)</Label>
                <Input id="gstPercent" name="gstPercent" type="number" step="0.01" defaultValue="5" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="subsidyEstimate">Est. government subsidy (₹)</Label>
                <Input id="subsidyEstimate" name="subsidyEstimate" type="number" step="0.01" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="validUntil">Valid until</Label>
                <Input id="validUntil" name="validUntil" type="date" />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] border-collapse text-sm">
                <thead>
                  <tr>
                    <th className="border p-1 text-left">Description</th>
                    <th className="border p-1 text-left">Specification</th>
                    <th className="border p-1 text-left">Qty</th>
                    <th className="border p-1 text-left">Rate (₹)</th>
                  </tr>
                </thead>
                <tbody>
                  {LINE_ITEM_DEFAULTS.map((row, i) => (
                    <tr key={i}>
                      <td className="border p-1">
                        <Input name={`item_${i}_description`} defaultValue={row.description} />
                      </td>
                      <td className="border p-1">
                        <Input name={`item_${i}_spec`} defaultValue={row.spec} />
                      </td>
                      <td className="border p-1">
                        <Input name={`item_${i}_qty`} type="number" step="0.01" className="w-20" />
                      </td>
                      <td className="border p-1">
                        <Input name={`item_${i}_rate`} type="number" step="0.01" className="w-28" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-1 text-xs text-muted-foreground">
                Clear a description to leave that row out of the estimate.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Terms &amp; conditions (optional — defaults to standard terms)</Label>
              <Textarea id="notes" name="notes" />
            </div>

            <Button type="submit">Create estimate</Button>
          </form>
        </CardContent>
      </Card>

      {lead.connection ? (
        <Card>
          <CardHeader>
            <CardTitle>Converted to Connection</CardTitle>
          </CardHeader>
          <CardContent>
            <a href={`/admin/connections/${lead.connection.id}`} className="underline underline-offset-4">
              View connection →
            </a>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Convert to Connection</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={convertAction} className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="address">Site address</Label>
                <Input id="address" name="address" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="systemSizeKw">System size (kW)</Label>
                <Input
                  id="systemSizeKw"
                  name="systemSizeKw"
                  type="number"
                  step="0.1"
                  defaultValue={currentEstimate?.systemSizeKw?.toString() ?? ""}
                />
              </div>
              <div className="sm:col-span-3">
                <Button type="submit">Convert to installation</Button>
              </div>
            </form>
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
