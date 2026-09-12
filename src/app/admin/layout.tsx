import Link from "next/link";
import { requireAdmin } from "@/lib/permissions";
import { signOut } from "@/auth";
import { Button } from "@/components/ui/button";

async function logoutAction() {
  "use server";
  await signOut({ redirectTo: "/login" });
}

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b print:hidden">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <nav className="flex gap-4 text-sm font-medium">
            <Link href="/admin/dashboard">Dashboard</Link>
            <Link href="/admin/leads">Leads</Link>
            <Link href="/admin/inventory">Inventory</Link>
            <Link href="/admin/connections">Connections</Link>
            <Link href="/admin/settings">Business Profile</Link>
          </nav>
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
