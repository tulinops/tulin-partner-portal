import { getBusinessProfile, updateBusinessProfile } from "@/server/business-profile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function BusinessProfilePage() {
  const tenant = await getBusinessProfile();

  async function saveAction(formData: FormData) {
    "use server";
    await updateBusinessProfile({
      businessAddress: String(formData.get("businessAddress") || "") || undefined,
      gstin: String(formData.get("gstin") || "") || undefined,
      contactPhone: String(formData.get("contactPhone") || "") || undefined,
      contactEmail: String(formData.get("contactEmail") || "") || undefined,
    });
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Business Profile</h1>
      <p className="text-sm text-muted-foreground">
        This appears on the letterhead of every printed estimate.
      </p>

      <Card>
        <CardHeader>
          <CardTitle>{tenant?.name}</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={saveAction} className="space-y-4">
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
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
