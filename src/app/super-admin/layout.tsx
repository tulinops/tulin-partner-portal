import Link from "next/link";
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
    <div className="min-h-screen flex flex-col bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2.5">
            <span
              aria-hidden
              className="size-2.5 shrink-0 rotate-45 rounded-[3px] bg-primary"
            />
            <span className="font-heading text-base font-extrabold tracking-tight">
              Tulin Partner Portal
              <span className="ml-1.5 font-sans text-xs font-semibold text-muted-foreground">
                Super Admin
              </span>
            </span>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/change-password">
              <Button variant="ghost" size="sm">
                Change password
              </Button>
            </Link>
            <form action={logoutAction}>
              <Button variant="ghost" size="sm" type="submit">
                Sign out
              </Button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">{children}</main>
    </div>
  );
}
