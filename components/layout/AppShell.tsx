import type { CSSProperties, ReactNode } from "react";
import { getCapabilities } from "@/lib/auth/session";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { MobileNav } from "./MobileNav";

/**
 * Shell shared by the investor and admin sections.
 *
 * Desktop metrics (measured on 1512x920) come from tokens in globals.css:
 *   sidebar 298px · content column 996px max · side padding ~109px · top 79px
 * The side padding is a percentage of the space left next to the sidebar, so
 * the proportion holds on other widths, and it is clamped at both ends. The
 * content column is centered, which keeps the padding symmetric on wide screens.
 *
 * Below md the sidebar is replaced by MobileNav (provisional, see that file).
 */
export async function AppShell({ children }: { children: ReactNode }) {
  const capabilities = await getCapabilities();

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": "var(--sidebar-width-desktop)",
        } as CSSProperties
      }
    >
      <AppSidebar />

      <SidebarInset className="bg-surface">
        <div
          className="flex flex-1 flex-col px-(--content-padding-inline) pt-(--content-padding-top) pb-24 md:pb-12"
          // pb leaves room for the provisional mobile bottom nav.
        >
          <div className="mx-auto w-full max-w-(--content-max-width) flex-1">
            {children}
          </div>
        </div>
      </SidebarInset>

      <MobileNav
        isInvestor={!!capabilities?.isInvestor}
        isAdmin={!!capabilities?.isAdmin}
      />
    </SidebarProvider>
  );
}
