"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { ChevronDownIcon } from "lucide-react";
import { es } from "@/i18n";
import { cn } from "@/lib/utils";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar";
import {
  ADMIN_NAV_ITEMS,
  CATALOG_NAV_ITEM,
  INVESTOR_NAV_ITEMS,
  type NavItem,
} from "./nav-items";
import { ADMIN_TABLES } from "@/app/(admin)/admin/table-definitions";

/**
 * Nav groups for the desktop sidebar.
 *
 * Takes plain booleans, never the item lists: the items carry icon *components*
 * and functions cannot cross the server/client boundary. The lists are imported
 * here, on the client side, so only serializable props are passed down.
 */
export function SidebarNav({
  isInvestor,
  isAdmin,
}: {
  isInvestor: boolean;
  isAdmin: boolean;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activeTabla = searchParams.get("tabla");

  // Auto-open when already on /admin
  const [panelOpen, setPanelOpen] = useState(pathname === "/admin");

  const isActive = (item: NavItem) =>
    item.exact
      ? pathname === item.href
      : pathname === item.href || pathname.startsWith(`${item.href}/`);

  // The admin sees everything, so the investor section shows for them too even
  // without a link; a visitor with neither capability only gets the catalog.
  const mainItems: NavItem[] =
    isInvestor || isAdmin
      ? [INVESTOR_NAV_ITEMS[0], CATALOG_NAV_ITEM, ...INVESTOR_NAV_ITEMS.slice(1)]
      : [CATALOG_NAV_ITEM];

  const menuButtonClassName = cn(
    // 36px tall, 11px inline padding, 10px icon-to-label gap, 14px / weight 400
    "h-9 gap-2.5 rounded-[5px] px-2.75 text-sm font-normal text-ink-700",
    "[&>svg]:size-4.5 [&>svg]:shrink-0",
    // Active: #F8F8F8 fill with a 1px #E2E2E2 outline.
    "data-active:border data-active:border-sidebar-border",
    "data-active:bg-sidebar-accent data-active:font-normal data-active:text-ink-700"
  );

  const renderMenu = (items: NavItem[]) => (
    <SidebarMenu className="gap-1">
      {items.map((item) => (
        <SidebarMenuItem key={item.href}>
          <SidebarMenuButton
            isActive={isActive(item)}
            tooltip={item.label}
            render={<Link href={item.href} />}
            className={menuButtonClassName}
          >
            <item.icon />
            <span>{item.label}</span>
          </SidebarMenuButton>
        </SidebarMenuItem>
      ))}
    </SidebarMenu>
  );

  // Group label sits on the same left edge as the item icons (11px of padding).
  const labelClassName =
    "h-auto px-2.75 pb-2 text-base font-normal text-ink-700";

  // ADMIN_NAV_ITEMS[0] is the panel itself — replaced by the collapsible below.
  // The rest (Usuarios, Pipeline) stay as regular items.
  const extraAdminItems = ADMIN_NAV_ITEMS.slice(1);
  const panelNavItem = ADMIN_NAV_ITEMS[0];

  return (
    <>
      <SidebarGroup className="gap-2 px-0">
        <SidebarGroupLabel className={labelClassName}>
          {es.nav.investorSection}
        </SidebarGroupLabel>
        <SidebarGroupContent>{renderMenu(mainItems)}</SidebarGroupContent>
      </SidebarGroup>

      {isAdmin ? (
        <SidebarGroup className="gap-2 px-0">
          <SidebarGroupLabel className={labelClassName}>
            {es.nav.adminSection}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="gap-1">

              {/* ── Panel de tablas (desplegable) ──────────────────────── */}
              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={pathname === "/admin"}
                  tooltip={panelNavItem.label}
                  onClick={() => setPanelOpen((o) => !o)}
                  className={cn(menuButtonClassName, "w-full")}
                >
                  <panelNavItem.icon />
                  <span className="flex-1">{panelNavItem.label}</span>
                  <ChevronDownIcon
                    className={cn(
                      "ml-auto size-3.5 shrink-0 text-ink-500 transition-transform duration-200",
                      panelOpen && "rotate-180"
                    )}
                  />
                </SidebarMenuButton>

                {panelOpen ? (
                  <SidebarMenuSub>
                    {ADMIN_TABLES.map((table) => {
                      const href = `/admin?tabla=${table.id}`;
                      const isTableActive =
                        pathname === "/admin" &&
                        (activeTabla === table.id ||
                          (!activeTabla && table.id === ADMIN_TABLES[0].id));
                      return (
                        <SidebarMenuSubItem key={table.id}>
                          <SidebarMenuSubButton
                            isActive={isTableActive}
                            render={<Link href={href} />}
                            className="text-sm text-ink-700"
                          >
                            {table.label}
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                      );
                    })}
                  </SidebarMenuSub>
                ) : null}
              </SidebarMenuItem>

              {/* ── Resto de items admin (Usuarios, Pipeline…) ─────────── */}
              {extraAdminItems.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    isActive={isActive(item)}
                    tooltip={item.label}
                    render={<Link href={item.href} />}
                    className={menuButtonClassName}
                  >
                    <item.icon />
                    <span>{item.label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}

            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      ) : null}
    </>
  );
}
