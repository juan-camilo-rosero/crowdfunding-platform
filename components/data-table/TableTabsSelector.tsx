"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/** How far each arrow press scrolls the tab strip, in px. */
const SCROLL_STEP = 240;

/**
 * Flips to true once hydration is done. The arrows' enabled state comes from
 * measuring the DOM, which the server cannot do — without this gate the server
 * HTML and the first client render disagree on `disabled` and React reports a
 * hydration mismatch. useSyncExternalStore is used because it is the one hook
 * that renders `getServerSnapshot` during hydration and only then switches.
 */
const NEVER_CHANGES = () => () => {};
const getHydratedSnapshot = () => true;
const getServerSnapshot = () => false;

export type TableTab = {
  id: string;
  label: string;
};

export type TableTabsSelectorProps = {
  tabs: TableTab[];
  activeTabId: string;
  onTabChange: (tabId: string) => void;
  className?: string;
};

/**
 * Horizontally scrollable tab strip flanked by two arrow buttons.
 *
 * Reusable outside the admin panel: it only knows about `{id, label}` pairs and
 * reports the selection upward. Arrows disable themselves at each end, so on
 * first render the left one is disabled (the strip starts scrolled to 0).
 *
 * Design: 46px square arrows, 46px tall strip, both #F8F8F8 on a 1px #E2E2E2
 * rule; tabs 30px tall, selected fills with #060D1F.
 */
export function TableTabsSelector({
  tabs,
  activeTabId,
  onTabChange,
  className,
}: TableTabsSelectorProps) {
  const stripRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const isHydrated = useSyncExternalStore(
    NEVER_CHANGES,
    getHydratedSnapshot,
    getServerSnapshot
  );

  // Before hydration both arrows render disabled, matching the server output.
  const enableLeft = isHydrated && canScrollLeft;
  const enableRight = isHydrated && canScrollRight;

  const syncArrows = useCallback(() => {
    const node = stripRef.current;
    if (!node) return;
    const maxScroll = node.scrollWidth - node.clientWidth;
    setCanScrollLeft(node.scrollLeft > 1);
    setCanScrollRight(node.scrollLeft < maxScroll - 1);
  }, []);

  useEffect(() => {
    syncArrows();
    const node = stripRef.current;
    if (!node) return;
    const observer = new ResizeObserver(syncArrows);
    observer.observe(node);
    return () => observer.disconnect();
  }, [syncArrows, tabs.length]);

  function scrollBy(direction: -1 | 1) {
    stripRef.current?.scrollBy({
      left: direction * SCROLL_STEP,
      behavior: "smooth",
    });
  }

  // Disabled arrows keep the default cursor — no "forbidden" sign.
  const arrowClassName =
    "flex size-11.5 shrink-0 cursor-pointer items-center justify-center rounded-[5px] border border-line bg-elevated p-2.75 disabled:cursor-default disabled:opacity-40";

  return (
    <div className={cn("flex w-full items-center gap-2", className)}>
      <button
        type="button"
        onClick={() => scrollBy(-1)}
        disabled={!enableLeft}
        aria-label="Ver tablas anteriores"
        className={arrowClassName}
      >
        <ChevronLeftIcon
          className={cn("size-full", enableLeft ? "text-brand" : "text-ink-700")}
        />
      </button>

      <div
        ref={stripRef}
        onScroll={syncArrows}
        // Scrollbar hidden: the arrows are the affordance.
        className="flex h-11.5 min-w-0 flex-1 items-center gap-2 overflow-x-auto rounded-[10px] border border-line bg-elevated px-3 py-2 scrollbar-none"
      >
        {tabs.map((tab) => {
          const isActive = tab.id === activeTabId;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onTabChange(tab.id)}
              aria-current={isActive ? "true" : undefined}
              className={cn(
                // Width follows the label; height is fixed at 30px.
                "flex h-7.5 shrink-0 cursor-pointer items-center rounded-[5px] px-3 py-0.75 text-base font-normal whitespace-nowrap",
                isActive
                  ? "bg-brand text-elevated"
                  : "bg-elevated text-ink-700 hover:bg-surface"
              )}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      <button
        type="button"
        onClick={() => scrollBy(1)}
        disabled={!enableRight}
        aria-label="Ver tablas siguientes"
        className={arrowClassName}
      >
        <ChevronRightIcon
          className={cn("size-full", enableRight ? "text-brand" : "text-ink-700")}
        />
      </button>
    </div>
  );
}
