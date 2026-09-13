import Link from "next/link";
import {
  listRequiredDocumentTypes,
  createRequiredDocumentType,
  updateRequiredDocumentType,
} from "@/server/documents";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

async function createAction(formData: FormData) {
  "use server";
  await createRequiredDocumentType({
    name: String(formData.get("name")),
    description: String(formData.get("description") || "") || undefined,
  });
}

async function toggleActiveAction(formData: FormData) {
  "use server";
  await updateRequiredDocumentType({
    id: String(formData.get("id")),
    isActive: formData.get("isActive") === "true",
  });
}

export default async function RequiredDocumentsPage() {
  const types = await listRequiredDocumentTypes();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Required documents</h1>
        <p className="text-sm text-muted-foreground">
          The checklist every customer&apos;s connection is verified against. Add or retire document types here — it
          applies to every connection automatically.{" "}
          <Link href="/admin/settings" className="underline underline-offset-4">
            ← Back to Business Profile
          </Link>
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Add document type</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={createAction} className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" name="name" required placeholder="e.g. Identity proof" />
            </div>
            <div className="space-y-2 sm:col-span-1">
              <Label htmlFor="description">Description (optional)</Label>
              <Input id="description" name="description" />
            </div>
            <div className="flex items-end">
              <Button type="submit">Add</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>All document types</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Status</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {types.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="font-medium">{t.name}</TableCell>
                  <TableCell className="text-muted-foreground">{t.description ?? "—"}</TableCell>
                  <TableCell>
                    <Badge variant={t.isActive ? "default" : "secondary"}>{t.isActive ? "Active" : "Retired"}</Badge>
                  </TableCell>
                  <TableCell>
                    <form action={toggleActiveAction}>
                      <input type="hidden" name="id" value={t.id} />
                      <input type="hidden" name="isActive" value={String(!t.isActive)} />
                      <Button type="submit" variant="ghost" size="sm">
                        {t.isActive ? "Retire" : "Reactivate"}
                      </Button>
                    </form>
                  </TableCell>
                </TableRow>
              ))}
              {types.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">
                    No document types yet — add your first one above.
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
