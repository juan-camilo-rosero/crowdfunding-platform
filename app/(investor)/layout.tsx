import type { ReactNode } from "react";
import { getCapabilities } from "@/lib/auth/session";
import { AppShell } from "@/components/layout/AppShell";
import { ChatLauncher } from "@/components/chat/ChatLauncher";

export default async function InvestorLayout({
  children,
}: {
  children: ReactNode;
}) {
  // Only someone with the investor link gets the assistant: it exists to
  // explain their own position, and /api/chat refuses anyone else anyway. An
  // admin without a link would only ever see it answer "you have no capital".
  // getCapabilities is memoised per request, so AppShell's call is the only one
  // that costs anything.
  const capabilities = await getCapabilities();

  return (
    <>
      <AppShell>{children}</AppShell>
      {capabilities?.isInvestor ? <ChatLauncher /> : null}
    </>
  );
}
