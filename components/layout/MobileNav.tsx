"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  CATALOG_NAV_ITEM,
  INVESTOR_NAV_ITEMS,
  type NavItem,
} from "./nav-items";

/**
 * PROVISIONAL bottom navigation for small screens (the sidebar is desktop-only).
 *
 * Deliberately self-contained so it can be swapped wholesale for the real
 * design without touching anything else. Expect to replace the styling, the
 * item limit and the active indicator.
 *
 * Takes plain booleans rather than the item list: the items carry icon
 * *components*, and functions cannot cross the server/client boundary.
 */
export function MobileNav({
  isInvestor,
  isAdmin,
}: {
  isInvestor: boolean;
  isAdmin: boolean;
}) {
  const pathname = usePathname();

  // Same rule as the sidebar: admin sees everything, visitor only the catalog.
  const items: NavItem[] =
    isInvestor || isAdmin
      ? [INVESTOR_NAV_ITEMS[0], CATALOG_NAV_ITEM, ...INVESTOR_NAV_ITEMS.slice(1)]
      : [CATALOG_NAV_ITEM];

  // A bottom bar fits about five targets; the rest stay in the sidebar until
  // the real mobile navigation defines its own overflow.
  const visibleItems = items.slice(0, 5);

  return (
    <nav
      aria-label="Navegación principal"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-background md:hidden"
    >
      <ul className="flex items-stretch justify-around">
        {visibleItems.map((item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(`${item.href}/`);

          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "flex cursor-pointer flex-col items-center gap-1 px-1 py-2 text-[11px] leading-tight",
                  isActive ? "text-ink-900" : "text-ink-500"
                )}
              >
                <item.icon className="size-5" aria-hidden="true" />
                <span className="truncate">{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
