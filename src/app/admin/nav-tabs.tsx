"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "cn";

const LINKS = [
  { href: "/admin/dashboard", label: "Dashboard" },
  { href: "/admin/leads", label: "Leads" },
  { href: "/admin/inventory", label: "Inventory" },
  { href: "/admin/connections", label: "Connections" },
  { href: "/admin/staff", label: "Staff" },
  { href: "/admin/settings", label: "Business Profile" },
];

export function NavTabs() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-wrap gap-1 overflow-x-auto rounded-lg border border-border bg-secondary p-1">
      {LINKS.map((link) => {
        const active =
          pathname === link.href || pathname.startsWith(`${link.href}/`);
        return (
          <Link
            key={link.href}
            href={link.href}
            className={cn(
              "shrink-0 rounded-md px-3 py-1.5 text-sm font-semibold whitespace-nowrap transition-colors",
              active
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
