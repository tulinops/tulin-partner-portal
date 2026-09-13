import { redirect } from "next/navigation";
import { AuthError } from "next-auth";
import { auth, signIn } from "@/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

async function loginAction(formData: FormData) {
  "use server";

  try {
    await signIn("credentials", {
      email: formData.get("email"),
      password: formData.get("password"),
      redirect: false,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      redirect("/login?error=invalid");
    }
    throw error;
  }

  const session = await auth();
  if (session?.user.role === "SUPER_ADMIN") {
    redirect("/super-admin/tenants");
  }
  redirect("/admin/dashboard");
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await auth();
  if (session?.user.role === "SUPER_ADMIN") redirect("/super-admin/tenants");
  if (session?.user.role === "ADMIN") redirect("/admin/dashboard");

  const { error } = await searchParams;

  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm space-y-4">
        <Card className="shadow-lg">
          <CardHeader className="items-center text-center">
            <div className="mb-1 flex items-center gap-2">
              <span aria-hidden className="size-3 shrink-0 rotate-45 rounded-[3px] bg-primary" />
              <span className="font-heading text-base font-extrabold tracking-tight">Tulin Partner Portal</span>
            </div>
            <CardTitle className="text-lg">Sign in to your business</CardTitle>
            <p className="text-sm text-muted-foreground">
              Manage leads, estimates and installations in one place.
            </p>
          </CardHeader>
          <CardContent>
            <form action={loginAction} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" name="email" type="email" required autoFocus />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input id="password" name="password" type="password" required />
              </div>
              {error && (
                <p className="text-sm text-destructive">Invalid email or password.</p>
              )}
              <Button type="submit" className="w-full">
                Sign in
              </Button>
            </form>
          </CardContent>
        </Card>
        <p className="text-center text-xs text-muted-foreground">
          No public sign-up — Tulin onboards every business account.
        </p>
      </div>
    </div>
  );
}
