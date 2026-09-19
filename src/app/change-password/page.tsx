import { redirect } from "next/navigation";
import { changePassword } from "@/server/account";
import { SubmitButton } from "@/components/action-form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function ChangePasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string; error?: string }>;
}) {
  const { success, error } = await searchParams;

  async function changePasswordAction(formData: FormData) {
    "use server";
    try {
      await changePassword({
        currentPassword: String(formData.get("currentPassword") || ""),
        newPassword: String(formData.get("newPassword") || ""),
        confirmPassword: String(formData.get("confirmPassword") || ""),
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Something went wrong";
      redirect(`/change-password?error=${encodeURIComponent(message)}`);
    }
    redirect("/change-password?success=1");
  }

  return (
    <div className="mx-auto max-w-md space-y-6 py-10">
      <h1 className="font-heading text-2xl font-extrabold">Change password</h1>
      <Card>
        <CardHeader>
          <CardTitle>Update your password</CardTitle>
        </CardHeader>
        <CardContent>
          {success && (
            <p className="mb-4 rounded-md bg-primary/10 p-3 text-sm font-medium text-primary">
              Password updated successfully.
            </p>
          )}
          {error && <p className="mb-4 text-sm text-destructive">{error}</p>}
          <form action={changePasswordAction} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="currentPassword">Current password</Label>
              <Input
                id="currentPassword"
                name="currentPassword"
                type="password"
                required
                autoComplete="current-password"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="newPassword">New password</Label>
              <Input
                id="newPassword"
                name="newPassword"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm new password</Label>
              <Input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
              />
            </div>
            <SubmitButton>Update password</SubmitButton>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
