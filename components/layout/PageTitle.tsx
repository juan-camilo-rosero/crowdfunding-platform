import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Heading for a panel or screen. Shared by every panel so the scale stays in
 * one place — change it here and all titles follow.
 *
 * 30px / weight 500 / #1E1E1E.
 */
export function PageTitle({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <h1 className={cn("text-3xl font-medium text-ink-900", className)}>
      {children}
    </h1>
  );
}
