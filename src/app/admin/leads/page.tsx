import Link from "next/link";
import { listLeads, createLead } from "@/server/leads";
import { ActionForm } from "@/components/action-form";
import { asActionResult } from "@/lib/actionResult";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatusBadge, LEAD_STAGE_TONE } from "@/components/status-badge";
import { Textarea } from "@/components/ui/textarea";
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
import { PageHeader } from "@/components/layout/PageHeader";

const SOURCES = ["INSTAGRAM", "FACEBOOK", "WHATSAPP", "REFERRAL", "OTHER"] as const;

async function createLeadAction(formData: FormData) {
  "use server";
  return asActionResult(() => {
    const estimatedValue = formData.get("estimatedValue");
    const email = String(formData.get("email") || "");
    const requirementNotes = String(formData.get("requirementNotes") || "");
    return createLead({
      customerName: String(formData.get("customerName")),
      phone: String(formData.get("phone")),
      source: formData.get("source") as (typeof SOURCES)[number],
      estimatedValue: estimatedValue ? Number(estimatedValue) : undefined,
      email: email || undefined,
      requirementNotes: requirementNotes || undefined,
    });
  });
}

export default async function LeadsPage() {
  const leads = await listLeads();

  return (
    <div className="space-y-6">
      <PageHeader breadcrumbs={[{ label: "Leads" }]} title="Leads" />

      <Card>
        <CardHeader>
          <CardTitle>New Lead</CardTitle>
        </CardHeader>
        <CardContent>
          <ActionForm action={createLeadAction} successMessage="Lead added" className="grid gap-4 sm:grid-cols-4">
            <div className="space-y-2">
              <Label htmlFor="customerName">Customer name</Label>
              <Input id="customerName" name="customerName" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input id="phone" name="phone" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email (optional)</Label>
              <Input id="email" name="email" type="email" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="source">Source</Label>
              <Select name="source" defaultValue="OTHER">
                <SelectTrigger id="source">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SOURCES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="estimatedValue">Estimated value (₹)</Label>
              <Input id="estimatedValue" name="estimatedValue" type="number" />
            </div>
            <div className="space-y-2 sm:col-span-4">
              <Label htmlFor="requirementNotes">Customer requirements</Label>
              <Textarea
                id="requirementNotes"
                name="requirementNotes"
                placeholder="What the customer is asking for (roof type, monthly bill, budget, etc.)"
              />
            </div>
            <div className="sm:col-span-4">
              <Button type="submit">Add lead</Button>
            </div>
          </ActionForm>
        </CardContent>
      </Card>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Customer</TableHead>
            <TableHead>Phone</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Source</TableHead>
            <TableHead>Stage</TableHead>
            <TableHead>Est. value</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {leads.map((lead) => (
            <TableRow key={lead.id}>
              <TableCell>
                <Link href={`/admin/leads/${lead.id}`} className="font-medium underline-offset-4 hover:underline">
                  {lead.customerName}
                </Link>
              </TableCell>
              <TableCell>{lead.phone}</TableCell>
              <TableCell>{lead.email ?? "—"}</TableCell>
              <TableCell>{lead.source}</TableCell>
              <TableCell>
                <StatusBadge tone={LEAD_STAGE_TONE[lead.stage]} label={lead.stage.replace("_", " ")} />
              </TableCell>
              <TableCell>{lead.estimatedValue?.toString() ?? "—"}</TableCell>
              <TableCell>
                <Link
                  href={lead.connection ? `/admin/connections/${lead.connection.id}` : `/admin/leads/${lead.id}`}
                  className="text-sm font-semibold text-primary underline-offset-4 hover:underline"
                >
                  View →
                </Link>
              </TableCell>
            </TableRow>
          ))}
          {leads.length === 0 && (
            <TableRow>
              <TableCell colSpan={7} className="text-center text-muted-foreground">
                No leads yet.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
