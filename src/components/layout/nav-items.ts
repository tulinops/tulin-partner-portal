import type { LucideIcon } from "lucide-react";
import { Building2, LayoutDashboard, Package, Users, Zap, HardHat } from "lucide-react";

export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  children?: { label: string; href: string }[];
};

export const ADMIN_NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/admin/dashboard", icon: LayoutDashboard },
  { label: "Leads", href: "/admin/leads", icon: Users },
  { label: "Inventory", href: "/admin/inventory", icon: Package },
  { label: "Connections", href: "/admin/connections", icon: Zap },
  { label: "Staff", href: "/admin/staff", icon: HardHat },
  {
    label: "Business Profile",
    href: "/admin/settings",
    icon: Building2,
    children: [{ label: "Required documents", href: "/admin/settings/documents" }],
  },
];

export const SUPER_ADMIN_NAV_ITEMS: NavItem[] = [
  { label: "Tenants", href: "/super-admin/tenants", icon: Building2 },
];
