"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type TabBarItem = {
  id: string;
  label: string;
  /** Rendered at the inline start of the pill. Sized by this component. */
  icon?: ReactNode;
};

export type TabBarProps = {
  items: TabBarItem[];
  activeId: string;
  onSelect: (id: string) => void;
  /** Names the group for assistive tech, e.g. "Secciones del proyecto". */
  ariaLabel: string;
  className?: string;
};

/**
 * Row of pill tabs, each with an optional icon.
 *
 * Deliberately NOT the same component as data-table/TableTabsSelector: that one
 * is a scrolling strip with arrow controls, built for the admin panel's nine
 * tables inside a bordered box. This is a short, bare row that wraps. Folding
 * both into one would mean a `variant` prop that swaps the container, the
 * controls, the sizing and the colours — an abstraction in name only.
 *
 * Owns no state: the active tab comes in and the selection goes out, so the
 * caller decides whether it lives in React state, the URL or anywhere else.
 */
export function TabBar({
  items,
  activeId,
  onSelect,
  ariaLabel,
  className,
}: TabBarProps) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cn("flex flex-wrap items-center gap-2", className)}
    >
      {items.map((item) => {
        const isActive = item.id === activeId;
        return (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            aria-controls={`panel-${item.id}`}
            id={`tab-${item.id}`}
            onClick={() => onSelect(item.id)}
            className={cn(
              "flex h-10 cursor-pointer items-center gap-2 rounded-[10px] px-4 text-sm font-medium whitespace-nowrap transition-colors [&>svg]:size-4",
              isActive
                ? "bg-slate-950 text-stone-50"
                : "bg-stone-50 text-stone-900 outline outline-1 -outline-offset-1 outline-neutral-200 hover:bg-stone-100"
            )}
          >
            {item.icon}
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
