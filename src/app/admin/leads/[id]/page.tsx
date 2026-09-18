import { notFound, redirect } from "next/navigation";
import { getLead, addLeadNote, updateLeadDetails } from "@/server/leads";
import { ActionForm } from "@/components/action-form";
import { asActionResult } from "@/lib/actionResult";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { StatusBadge, LEAD_STAGE_TONE } from "@/components/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EstimateWorkflowSection } from "./estimate-workflow-section";
import { CustomerTabs } from "@/app/admin/connections/[id]/customer-tabs";
import { getBusinessProfile } from "@/server/business-profile";
import { PageHeader } from "@/components/layout/PageHeader";

const NOT_YET_A_CUSTOMER = (
  <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
    Available once this lead becomes a customer — approving a quotation starts the customer journey.
  </p>
);

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
  // Once a lead converts, everything about it (Lead, Estimate, and the
  // Site Visit/Documents/.../Warranty tabs) lives on and is fully rendered
  // by the Connection page — there's nothing left for this page to show.
  if (lead.connection) redirect(`/admin/connections/${lead.connection.id}`);
  const tenant = await getBusinessProfile();

  const currentEstimate = lead.estimates.find((e) => e.isCurrent);
  const stage = lead.estimates.length > 0 ? "estimate" : "lead";

  async function addNoteAction(formData: FormData) {
    "use server";
    return asActionResult(() => {
      const followUpAt = formData.get("followUpAt");
      return addLeadNote({
        leadId: id,
        body: String(formData.get("body")),
        followUpAt: followUpAt ? new Date(String(followUpAt)) : undefined,
      });
    });
  }

  async function updateDetailsAction(formData: FormData) {
    "use server";
    return asActionResult(() =>
      updateLeadDetails({
        leadId: id,
        email: String(formData.get("email") || "") || undefined,
        address: String(formData.get("address") || "") || undefined,
        requirementNotes: String(formData.get("requirementNotes") || "") || undefined,
      }),
    );
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
        <ActionForm action={updateDetailsAction} successMessage="Details saved" className="space-y-4">
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
        </ActionForm>
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
          // Always null here — this page redirects to the Connection page
          // above as soon as lead.connection exists.
          connectionStage={null}
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
      <PageHeader
        breadcrumbs={[{ label: "Leads", href: "/admin/leads" }, { label: lead.customerName }]}
        eyebrow={`Lead #${lead.id.slice(-6).toUpperCase()}`}
        title={lead.customerName}
        description={
          <>
            <span className="font-mono font-semibold text-foreground">{lead.phone}</span>
            <span>
              Source: <span className="font-semibold text-foreground">{lead.source}</span>
            </span>
            {lead.email && <span>{lead.email}</span>}
          </>
        }
        actions={<StatusBadge tone={LEAD_STAGE_TONE[lead.stage]} label={lead.stage.replace("_", " ")} />}
      />

      <CustomerTabs
        currentStage={stage}
        overview={overviewSection}
        lead={leadSection}
        estimate={estimateSection}
        sitevisit={NOT_YET_A_CUSTOMER}
        documents={NOT_YET_A_CUSTOMER}
        subsidyloan={NOT_YET_A_CUSTOMER}
        installation={NOT_YET_A_CUSTOMER}
        invoice={NOT_YET_A_CUSTOMER}
        warranty={NOT_YET_A_CUSTOMER}
        activity={activitySection}
      />
    </div>
  );
}
