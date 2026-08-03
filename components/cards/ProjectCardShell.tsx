import type { ReactNode } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

export type ProjectCardShellProps = {
  /** Project id; the whole card links to its detail screen. */
  projectId: string;
  /** Text of the call to action pinned to the bottom edge. */
  action: string;
  children: ReactNode;
  className?: string;
};

/**
 * Frame every project card shares: the link wrapper, the border and padding,
 * and the call to action pinned to the bottom.
 *
 * It exists so the catalogue card and the "mis inversiones" card cannot drift
 * apart geometrically — they differ in CONTENT, never in shape. Whatever the
 * variants put inside, the card fills its grid cell and its action lines up
 * with every other card in the row.
 *
 * The whole card is the link, so a click anywhere opens the project. The action
 * is therefore a styled span, not a nested <a>, which would be invalid markup.
 */
export function ProjectCardShell({
  projectId,
  action,
  children,
  className,
}: ProjectCardShellProps) {
  return (
    <Link
      href={`/proyecto/${projectId}`}
      className={cn(
        "group flex h-full w-full cursor-pointer flex-col gap-3 rounded-[10px] border border-neutral-200 bg-stone-50 p-4 transition-shadow hover:shadow-md",
        className
      )}
    >
      {children}

      {/* mt-auto pins it to the bottom, so every card's action lines up even
          when the content above is shorter. */}
      <span className="mt-auto flex h-10 w-full shrink-0 items-center justify-center rounded-[10px] bg-stone-900 text-base font-medium text-white transition-opacity group-hover:opacity-90">
        {action}
      </span>
    </Link>
  );
}
