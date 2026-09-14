import Link from "next/link";
import { notFound } from "next/navigation";
import { getLead, addLeadNote, updateLeadDetails } from "@/server/leads";
import { getConnectionStageForLead } from "@/server/connections";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EstimateWorkflowSection } from "./estimate-workflow-section";
import { CustomerTabs } from "@/app/admin/connections/[id]/customer-tabs";
import { getBusinessProfile } from "@/server/business-profile";

const NOT_YET_A_CUSTOMER = (
  <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
    Available once this lead becomes a customer — approve a quotation and schedule its site visit from the
    Estimate tab to start the customer journey.
  </p>
);

function seeOnConnectionPage(connectionId: string) {
  return (
    <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
      This lead has already converted to a customer — its Site Visit, Documents, Payments, Installation,
      Invoice and Warranty tabs are managed from there instead of here.{" "}
      <Link
        href={`/admin/connections/${connectionId}`}
        className="font-semibold text-primary underline underline-offset-4"
      >
        View the Connection page →
      </Link>
    </p>
  );
}

export default async function LeadDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ quote?: string }>;
}) {
  const { id } = await params;
  const { quote: activeEstimateId } = await searchParams;
  const lead = await getLead(id);
  if (!lead) notFound();
  const tenant = await getBusinessProfile();
  const connectionStage = lead.connection ? await getConnectionStageForLead(id) : null;
  const customerOnlyTabContent = lead.connection ? seeOnConnectionPage(lead.connection.id) : NOT_YET_A_CUSTOMER;

  const currentEstimate = lead.estimates.find((e) => e.isCurrent);
  const stage = connectionStage ?? (lead.estimates.length > 0 ? "estimate" : "lead");

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

  const overviewSection = (
    <div className="space-y-6">
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
        <CardTitle>Estimate</CardTitle>
      </CardHeader>
      <CardContent>
        <EstimateWorkflowSection
          leadId={id}
          estimates={lead.estimates}
          activeEstimateId={activeEstimateId}
          connectionStage={connectionStage}
          hasConnection={!!lead.connection}
          basePath={`/admin/leads/${id}`}
          customerName={lead.customerName}
          phone={lead.phone}
          email={lead.email}
          address={lead.address}
          tenantName={tenant?.name ?? "Your Business"}
          tenantAddress={tenant?.businessAddress}
          tenantGstin={tenant?.gstin}
          tenantPhone={tenant?.contactPhone}
          tenantEmail={tenant?.contactEmail}
        />
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
        sitevisit={customerOnlyTabContent}
        documents={customerOnlyTabContent}
        subsidyloan={customerOnlyTabContent}
        installation={customerOnlyTabContent}
        invoice={customerOnlyTabContent}
        warranty={customerOnlyTabContent}
        activity={activitySection}
      />
    </div>
  );
}
