import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { themeConfig } from "@/lib/theme-config";
import { AppSidebar } from "./AppSidebar";
import { AppHeader } from "./AppHeader";

export function AppShell({
  brand,
  portal,
  user,
  children,
}: {
  brand: { title: string; subtitle?: string | null };
  portal: "admin" | "super-admin";
  user: { name?: string | null; email?: string | null };
  children: React.ReactNode;
}) {
  return (
    <TooltipProvider delayDuration={200}>
      <SidebarProvider defaultOpen={!themeConfig.layout.sideNavCollapse}>
        <AppSidebar brand={brand} portal={portal} />
        <SidebarInset className="overflow-hidden bg-card">
          <AppHeader user={user} />
          <main className="flex-1 p-4">{children}</main>
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  );
}
