import { listTenantsWithCounts, createTenant } from "@/server/tenants";
import type { BusinessType } from "@/generated/prisma/enums";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CreateTenantForm } from "./create-tenant-form";

async function createTenantAction(
  _prevState: { tempPassword?: string; adminEmail?: string; error?: string } | null,
  formData: FormData,
) {
  "use server";
  try {
    const { tempPassword } = await createTenant({
      name: String(formData.get("name")),
      slug: String(formData.get("slug")),
      businessType: formData.get("businessType") as BusinessType,
      adminName: String(formData.get("adminName")),
      adminEmail: String(formData.get("adminEmail")),
    });
    return { tempPassword, adminEmail: String(formData.get("adminEmail")) };
  } catch {
    return { error: "Could not create tenant — check the slug/email aren't already used." };
  }
}

export default async function TenantsPage() {
  const tenants = await listTenantsWithCounts();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Tenants</h1>
      <p className="text-sm text-muted-foreground">
        Metadata only — tenant business data (leads, inventory, finance) is private to each tenant
        and never shown here.
      </p>

      <Card>
        <CardHeader>
          <CardTitle>Onboard a new tenant</CardTitle>
        </CardHeader>
        <CardContent>
          <CreateTenantForm action={createTenantAction} />
        </CardContent>
      </Card>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Leads</TableHead>
            <TableHead>Connections</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {tenants.map((t) => (
            <TableRow key={t.id}>
              <TableCell className="font-medium">{t.name}</TableCell>
              <TableCell>{t.businessType}</TableCell>
              <TableCell>
                <Badge variant={t.isActive ? "default" : "destructive"}>
                  {t.isActive ? "Active" : "Suspended"}
                </Badge>
              </TableCell>
              <TableCell>{t._count.leads}</TableCell>
              <TableCell>{t._count.connections}</TableCell>
            </TableRow>
          ))}
          {tenants.length === 0 && (
            <TableRow>
              <TableCell colSpan={5} className="text-center text-muted-foreground">
                No tenants yet.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
