"use client";

import { useState, useTransition } from "react";
import { LogOutIcon, MoreHorizontalIcon } from "lucide-react";
import { es } from "@/i18n";
import { signOut } from "@/lib/auth/actions";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";

export type SidebarAccountProps = {
  name: string;
  /** Capability label already resolved on the server. */
  roleLabel: string;
  /** Avatar coming from the OAuth provider; null renders a gray placeholder. */
  avatarUrl: string | null;
};

/**
 * Account block pinned to the bottom of the sidebar: photo, name, capability
 * label and an overflow menu whose only action today is signing out.
 */
export function SidebarAccount({ name, roleLabel, avatarUrl }: SidebarAccountProps) {
  const [isSigningOut, startSignOut] = useTransition();
  const [open, setOpen] = useState(false);

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      {/*
        The whole row is the trigger, not just the dots: anywhere in the account
        block opens the menu. Scaled down a notch from the original 67px spec.
      */}
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            aria-label={es.account.openMenu}
            className="h-15 w-full justify-between gap-3 rounded-[5px] py-3 pr-3 pl-2.25 hover:bg-sidebar-accent"
          />
        }
      >
        <span className="flex min-w-0 items-center gap-2.5">
          {avatarUrl ? (
            <Avatar className="size-9.5 shrink-0">
              <AvatarImage src={avatarUrl} alt="" />
              <AvatarFallback>
                <Skeleton className="size-full rounded-full" />
              </AvatarFallback>
            </Avatar>
          ) : (
            // No provider photo: gray placeholder at the final size.
            <Skeleton className="size-9.5 shrink-0 rounded-full" />
          )}

          <span className="min-w-0 text-left">
            <span className="block truncate text-sm font-normal text-ink-700">
              {name}
            </span>
            <span className="block truncate text-xs font-normal text-ink-400">
              {roleLabel}
            </span>
          </span>
        </span>

        <MoreHorizontalIcon className="shrink-0 text-ink-500" />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" side="top" className="w-48">
        <DropdownMenuItem
          disabled={isSigningOut}
          onClick={() => startSignOut(() => void signOut())}
        >
          <LogOutIcon />
          {isSigningOut ? es.account.signingOut : es.account.signOut}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
