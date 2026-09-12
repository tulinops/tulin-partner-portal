import Link from "next/link";
import { listLeads, createLead } from "@/server/leads";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

const SOURCES = ["INSTAGRAM", "FACEBOOK", "WHATSAPP", "REFERRAL", "OTHER"] as const;

async function createLeadAction(formData: FormData) {
  "use server";
  const estimatedValue = formData.get("estimatedValue");
  await createLead({
    customerName: String(formData.get("customerName")),
    phone: String(formData.get("phone")),
    source: formData.get("source") as (typeof SOURCES)[number],
    estimatedValue: estimatedValue ? Number(estimatedValue) : undefined,
  });
}

export default async function LeadsPage() {
  const leads = await listLeads();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Leads</h1>

      <Card>
        <CardHeader>
          <CardTitle>New Lead</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={createLeadAction} className="grid gap-4 sm:grid-cols-4">
            <div className="space-y-2">
              <Label htmlFor="customerName">Customer name</Label>
              <Input id="customerName" name="customerName" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input id="phone" name="phone" required />
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
            <div className="sm:col-span-4">
              <Button type="submit">Add lead</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Customer</TableHead>
            <TableHead>Phone</TableHead>
            <TableHead>Source</TableHead>
            <TableHead>Stage</TableHead>
            <TableHead>Est. value</TableHead>
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
              <TableCell>{lead.source}</TableCell>
              <TableCell>
                <Badge variant={lead.stage === "WON" ? "default" : lead.stage === "LOST" ? "destructive" : "secondary"}>
                  {lead.stage.replace("_", " ")}
                </Badge>
              </TableCell>
              <TableCell>{lead.estimatedValue?.toString() ?? "—"}</TableCell>
            </TableRow>
          ))}
          {leads.length === 0 && (
            <TableRow>
              <TableCell colSpan={5} className="text-center text-muted-foreground">
                No leads yet.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
