import { SearchIcon } from "lucide-react";
import { es } from "@/i18n";
import { getCapabilities, getCurrentUserProfile } from "@/lib/auth/session";
import { BrandLogo } from "@/components/auth/BrandLogo";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarSeparator,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Input } from "@/components/ui/input";
import { SidebarAccount } from "./SidebarAccount";
import { SidebarNav } from "./SidebarNav";

/**
 * Desktop sidebar, built from CAPABILITIES (see .claude/docs/user-management.md):
 * the investor group shows when the user has a link in `investors`, the admin
 * group when users.role = 'admin'. The owner has both and sees both.
 *
 * Layout order: logo -> search -> separator -> menu -> (bottom) account.
 */
export async function AppSidebar() {
  const [capabilities, profile] = await Promise.all([
    getCapabilities(),
    getCurrentUserProfile(),
  ]);

  if (!capabilities || !profile) return null;

  // A person can hold both capabilities; the footer shows the highest one.
  const roleLabel = capabilities.isAdmin
    ? es.account.admin
    : capabilities.isInvestor
      ? es.account.investor
      : es.account.visitor;

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <SidebarHeader className="gap-4 p-4">
        <div className="flex items-center justify-between gap-2">
          <BrandLogo
            className="min-w-0 flex-1 justify-start"
            imageClassName="h-14"
          />
          <SidebarTrigger aria-label={es.nav.toggleSidebar} />
        </div>

        <div className="group-data-[collapsible=icon]:hidden">
          {/*
            Placeholder and icon at #585858. Same 36px height and #F8F8F8 fill
            as the nav items, with the #E2E2E2 outline they share.
          */}
          <Input
            type="search"
            icon={<SearchIcon />}
            placeholder={es.nav.search}
            aria-label={es.nav.search}
            className="h-9 rounded-[5px] border-sidebar-border bg-sidebar-accent pl-9 text-sm font-normal text-ink-700 placeholder:text-ink-700 focus-visible:border-ink-700 focus-visible:ring-0 md:text-sm"
            wrapperClassName="[&>span]:left-2.75 [&>span]:text-ink-700 [&_svg]:size-4.5"
          />
        </div>
      </SidebarHeader>

      <SidebarSeparator className="mx-0" />

      <SidebarContent className="px-2 py-4">
        <SidebarNav
          isInvestor={capabilities.isInvestor}
          isAdmin={capabilities.isAdmin}
        />
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-3 group-data-[collapsible=icon]:hidden">
        <SidebarAccount
          name={profile.full_name ?? profile.email}
          roleLabel={roleLabel}
          avatarUrl={profile.avatar_url}
        />
      </SidebarFooter>
    </Sidebar>
  );
}
