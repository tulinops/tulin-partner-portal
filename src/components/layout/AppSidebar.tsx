"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarRail,
} from "@/components/ui/sidebar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ADMIN_NAV_ITEMS, SUPER_ADMIN_NAV_ITEMS } from "./nav-items";

function isActivePath(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppSidebar({
  brand,
  portal,
}: {
  brand: { title: string; subtitle?: string | null };
  portal: "admin" | "super-admin";
}) {
  const pathname = usePathname();
  const items = portal === "admin" ? ADMIN_NAV_ITEMS : SUPER_ADMIN_NAV_ITEMS;

  return (
    <Sidebar variant="inset" collapsible="icon" className="print:hidden">
      <SidebarHeader>
        <div className="flex items-center gap-2.5 px-2 py-1.5">
          <span aria-hidden className="size-2.5 shrink-0 rotate-45 rounded-[3px] bg-primary" />
          <div className="min-w-0 group-data-[collapsible=icon]:hidden">
            <p className="truncate font-heading text-sm font-extrabold tracking-tight">{brand.title}</p>
            {brand.subtitle && <p className="truncate text-xs text-muted-foreground">{brand.subtitle}</p>}
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarMenu>
            {items.map((item) =>
              item.children ? (
                <Collapsible key={item.href} defaultOpen={isActivePath(pathname, item.href)} className="group/collapsible">
                  <SidebarMenuItem>
                    <CollapsibleTrigger asChild>
                      <SidebarMenuButton isActive={isActivePath(pathname, item.href)} tooltip={item.label}>
                        <item.icon className="size-[18px]" />
                        <span>{item.label}</span>
                      </SidebarMenuButton>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <SidebarMenuSub>
                        {item.children.map((child) => (
                          <SidebarMenuSubItem key={child.href}>
                            <SidebarMenuSubButton asChild isActive={isActivePath(pathname, child.href)}>
                              <Link href={child.href}>{child.label}</Link>
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                        ))}
                      </SidebarMenuSub>
                    </CollapsibleContent>
                  </SidebarMenuItem>
                </Collapsible>
              ) : (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton asChild isActive={isActivePath(pathname, item.href)} tooltip={item.label}>
                    <Link href={item.href}>
                      <item.icon className="size-[18px]" />
                      <span>{item.label}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ),
            )}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  );
}
