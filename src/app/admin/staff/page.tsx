import { listStaffMembers, createStaffMember } from "@/server/staff";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/PageHeader";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

async function createStaffAction(formData: FormData) {
  "use server";
  await createStaffMember({
    name: String(formData.get("name")),
    phone: String(formData.get("phone") || "") || undefined,
    designation: String(formData.get("designation") || "") || undefined,
    address: String(formData.get("address") || "") || undefined,
  });
}

export default async function StaffPage() {
  const staff = await listStaffMembers();

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={[{ label: "Staff" }]}
        title="Staff"
        description="Workers you assign to site visits and installations. No login access — this is just a name/phone record."
      />

      <Card>
        <CardHeader>
          <CardTitle>Add worker</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={createStaffAction} className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" name="name" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone (optional)</Label>
              <Input id="phone" name="phone" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="designation">Designation (optional)</Label>
              <Input id="designation" name="designation" />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="address">Address (optional)</Label>
              <Input id="address" name="address" />
            </div>
            <div className="flex items-end">
              <Button type="submit">Add worker</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>All workers</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Designation</TableHead>
                <TableHead>Address</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {staff.map((s) => (
                <TableRow key={s.id}>
                  <TableCell>{s.name}</TableCell>
                  <TableCell>{s.phone ?? "—"}</TableCell>
                  <TableCell>{s.designation ?? "—"}</TableCell>
                  <TableCell>{s.address ?? "—"}</TableCell>
                </TableRow>
              ))}
              {staff.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">
                    No workers added yet.
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
