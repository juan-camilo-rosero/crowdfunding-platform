import type { ReactNode } from "react";
import { Sidebar } from "./Sidebar";

/**
 * Shared shell for the investor and admin sections. Both use the same sidebar
 * so a user with both capabilities (the owner) can jump between sections from
 * anywhere. Structural only — no visual polish yet.
 */
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-1">
      <Sidebar />
      <div className="flex flex-1 flex-col">{children}</div>
    </div>
  );
}
