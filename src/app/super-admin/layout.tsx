import { requireSuperAdmin } from "@/lib/permissions";
import { signOut } from "@/auth";
import { Button } from "@/components/ui/button";

async function logoutAction() {
  "use server";
  await signOut({ redirectTo: "/login" });
}

export default async function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  await requireSuperAdmin();

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <span className="text-sm font-medium">Tulin Partner Portal — Super Admin</span>
          <form action={logoutAction}>
            <Button variant="ghost" size="sm" type="submit">
              Sign out
            </Button>
          </form>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">{children}</main>
    </div>
  );
}
