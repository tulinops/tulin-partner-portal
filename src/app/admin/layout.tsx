import { requireAdmin } from "@/lib/permissions";
import { getBusinessProfile } from "@/server/business-profile";
import { AppShell } from "@/components/layout/AppShell";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await requireAdmin();
  const tenant = await getBusinessProfile();

  return (
    <AppShell
      brand={{ title: "Tulin Partner Portal", subtitle: tenant?.name }}
      portal="admin"
      user={{ name: session.user.name, email: session.user.email }}
    >
      {children}
    </AppShell>
  );
}
