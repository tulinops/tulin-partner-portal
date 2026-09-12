import { notFound } from "next/navigation";
import { getLead, moveLeadStage, addLeadNote, convertLeadToConnection } from "@/server/leads";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const STAGES = ["NEW", "CONTACTED", "SITE_VISIT", "QUOTED", "WON", "LOST"] as const;

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

  async function convertAction(formData: FormData) {
    "use server";
    const systemSizeKw = formData.get("systemSizeKw");
    await convertLeadToConnection({
      leadId: id,
      address: String(formData.get("address") || ""),
      systemSizeKw: systemSizeKw ? Number(systemSizeKw) : undefined,
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{lead.customerName}</h1>
          <p className="text-sm text-muted-foreground">{lead.phone} · {lead.source}</p>
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
                <Input id="systemSizeKw" name="systemSizeKw" type="number" step="0.1" />
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
