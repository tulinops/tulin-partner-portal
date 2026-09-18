import Link from "next/link";
import { getBusinessProfile, updateBusinessProfile } from "@/server/business-profile";
import { ActionForm } from "@/components/action-form";
import { asActionResult } from "@/lib/actionResult";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/PageHeader";

export default async function BusinessProfilePage() {
  const tenant = await getBusinessProfile();

  async function saveAction(formData: FormData) {
    "use server";
    return asActionResult(() =>
      updateBusinessProfile({
        businessAddress: String(formData.get("businessAddress") || "") || undefined,
        gstin: String(formData.get("gstin") || "") || undefined,
        contactPhone: String(formData.get("contactPhone") || "") || undefined,
        contactEmail: String(formData.get("contactEmail") || "") || undefined,
      }),
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={[{ label: "Business Profile" }]}
        title="Business Profile"
        description="This appears on the letterhead of every printed estimate."
      />

      <Card>
        <CardHeader>
          <CardTitle>{tenant?.name}</CardTitle>
        </CardHeader>
        <CardContent>
          <ActionForm action={saveAction} successMessage="Business profile updated" className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="businessAddress">Business address</Label>
              <Textarea
                id="businessAddress"
                name="businessAddress"
                defaultValue={tenant?.businessAddress ?? ""}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="gstin">GSTIN</Label>
                <Input id="gstin" name="gstin" defaultValue={tenant?.gstin ?? ""} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contactPhone">Phone</Label>
                <Input id="contactPhone" name="contactPhone" defaultValue={tenant?.contactPhone ?? ""} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contactEmail">Email</Label>
                <Input
                  id="contactEmail"
                  name="contactEmail"
                  type="email"
                  defaultValue={tenant?.contactEmail ?? ""}
                />
              </div>
            </div>
            <Button type="submit" size="sm">
              Save
            </Button>
          </ActionForm>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Required documents</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-3 text-sm text-muted-foreground">
            The checklist every customer&apos;s connection is verified against — configurable per business.
          </p>
          <Link href="/admin/settings/documents">
            <Button variant="outline" size="sm">
              Manage document types →
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
