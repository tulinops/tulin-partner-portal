import { X } from "lucide-react";
import {
  listRequiredDocumentTypes,
  createRequiredDocumentType,
  deleteRequiredDocumentType,
} from "@/server/documents";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/PageHeader";
import { ActionForm } from "@/components/action-form";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { asActionResult } from "@/lib/actionResult";
import { DocumentTypeStatusToggle } from "./status-toggle";
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
  return asActionResult(() =>
    createRequiredDocumentType({
      name: String(formData.get("name")),
      description: String(formData.get("description") || "") || undefined,
    }),
  );
}

async function deleteAction(formData: FormData) {
  "use server";
  return asActionResult(() => deleteRequiredDocumentType(String(formData.get("id"))));
}

export default async function RequiredDocumentsPage() {
  const types = await listRequiredDocumentTypes();

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={[{ label: "Business Profile", href: "/admin/settings" }, { label: "Required documents" }]}
        title="Required documents"
        description="The checklist every customer's connection is verified against. Add or retire document types here — it applies to every connection automatically."
      />

      <Card>
        <CardHeader>
          <CardTitle>Add document type</CardTitle>
        </CardHeader>
        <CardContent>
          <ActionForm action={createAction} successMessage="Document type added" className="grid gap-4 sm:grid-cols-3">
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
          </ActionForm>
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
                    <DocumentTypeStatusToggle id={t.id} initialActive={t.isActive} />
                  </TableCell>
                  <TableCell>
                    <ActionForm action={deleteAction} successMessage="Document type deleted">
                      <input type="hidden" name="id" value={t.id} />
                      <ConfirmSubmitButton
                        type="submit"
                        variant="ghost"
                        size="icon-sm"
                        className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                        title={`Delete ${t.name}`}
                        confirmMessage={`Delete "${t.name}"? This can't be undone. Connections that already have this document on file will block the delete — retire it instead if that's the case.`}
                      >
                        <X />
                      </ConfirmSubmitButton>
                    </ActionForm>
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
