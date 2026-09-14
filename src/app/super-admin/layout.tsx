import { requireSuperAdmin } from "@/lib/permissions";
import { AppShell } from "@/components/layout/AppShell";

export default async function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSuperAdmin();

  return (
    <AppShell
      brand={{ title: "Tulin Partner Portal", subtitle: "Super Admin" }}
      portal="super-admin"
      user={{ name: session.user.name, email: session.user.email }}
    >
      {children}
    </AppShell>
  );
}
