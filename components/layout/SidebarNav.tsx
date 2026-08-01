"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { es } from "@/i18n";
import { cn } from "@/lib/utils";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import {
  ADMIN_NAV_ITEMS,
  CATALOG_NAV_ITEM,
  INVESTOR_NAV_ITEMS,
  type NavItem,
} from "./nav-items";

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

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`);

  // The admin sees everything, so the investor section shows for them too even
  // without a link; a visitor with neither capability only gets the catalog.
  const mainItems: NavItem[] =
    isInvestor || isAdmin
      ? [INVESTOR_NAV_ITEMS[0], CATALOG_NAV_ITEM, ...INVESTOR_NAV_ITEMS.slice(1)]
      : [CATALOG_NAV_ITEM];

  const renderMenu = (items: NavItem[]) => (
    <SidebarMenu className="gap-1">
      {items.map((item) => (
        <SidebarMenuItem key={item.href}>
          <SidebarMenuButton
            isActive={isActive(item.href)}
            tooltip={item.label}
            render={<Link href={item.href} />}
            className={cn(
              // 36px tall (scaled down from the original 41px), 11px inline
              // padding, 10px icon-to-label gap, 14px / weight 400 / #585858.
              "h-9 gap-2.5 rounded-[5px] px-2.75 text-sm font-normal text-ink-700",
              "[&>svg]:size-4.5 [&>svg]:shrink-0",
              // Active: #F8F8F8 fill with a 1px #E2E2E2 outline.
              // Base UI renders the flag as `data-active=""`, so the variant is
              // `data-active:` (attribute present), NOT `data-[active=true]:`.
              "data-active:border data-active:border-sidebar-border",
              "data-active:bg-sidebar-accent data-active:font-normal data-active:text-ink-700"
            )}
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
          <SidebarGroupContent>{renderMenu(ADMIN_NAV_ITEMS)}</SidebarGroupContent>
        </SidebarGroup>
      ) : null}
    </>
  );
}
