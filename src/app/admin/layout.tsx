import Link from "next/link";
import { requireAdmin } from "@/lib/permissions";
import { signOut } from "@/auth";
import { Button } from "@/components/ui/button";
import { NavTabs } from "./nav-tabs";

async function logoutAction() {
  "use server";
  await signOut({ redirectTo: "/login" });
}

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="border-b border-border print:hidden">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-4 py-3">
          <div className="flex items-center gap-2.5">
            <span
              aria-hidden
              className="size-2.5 shrink-0 rotate-45 rounded-[3px] bg-primary"
            />
            <span className="font-heading text-base font-extrabold tracking-tight">
              Tulin Partner Portal
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <NavTabs />
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
