import type { ReactNode } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

export type EmptyStateProps = {
  /** Icon shown in the circle. Sized by this component. */
  icon: ReactNode;
  /** What is missing, in one line. */
  title: string;
  /** Why it is missing or what to do about it. */
  hint: string;
  /** Way out, when the user can actually do something about it. */
  action?: { href: string; label: string };
  className?: string;
};

/**
 * The panel shown where a grid or a list would be, when there is nothing to
 * put in it. Never a blank area — a data screen always says why it is empty
 * (see code-patterns.md).
 *
 * Shared so every empty screen in the app reads the same. `action` is optional
 * on purpose: it is offered only when there is a real way out. "You have no
 * investments yet" can point at the catalogue; "no project matches these
 * filters" can clear them; a portfolio with no projects published yet can do
 * neither, and an empty state that offers a dead end is worse than one that
 * simply explains.
 */
export function EmptyState({
  icon,
  title,
  hint,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-3 rounded-[10px] border border-neutral-200 bg-stone-50 px-6 py-12 text-center",
        className
      )}
    >
      <span
        aria-hidden="true"
        className="flex size-11 items-center justify-center rounded-full bg-zinc-100 text-zinc-500 [&>svg]:size-5"
      >
        {icon}
      </span>

      <div>
        <p className="text-base font-medium text-stone-900">{title}</p>
        <p className="mt-1 text-sm text-zinc-500">{hint}</p>
      </div>

      {action ? (
        <Link
          href={action.href}
          className="mt-1 flex h-10 cursor-pointer items-center justify-center rounded-[10px] bg-stone-900 px-5 text-base font-medium text-white transition-opacity hover:opacity-90"
        >
          {action.label}
        </Link>
      ) : null}
    </div>
  );
}
