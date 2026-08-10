import { NextResponse } from "next/server";
import { es } from "@/i18n";
import { getVerifiedUser } from "@/lib/auth/claims";
import { createRequestClient } from "@/lib/supabase/request";
import { parseChatRequest } from "@/lib/ai/chat-request";
import {
  buildInvestorContext,
  primaryProjectName,
  renderInvestorContext,
  resolveInvestorIds,
  type ChatContextClient,
} from "@/lib/ai/context";
import {
  consumeRateLimit,
  isConversationLimitReached,
  trimHistory,
} from "@/lib/ai/limits";
import { generateChatCompletion } from "@/lib/ai/provider";
import { buildSystemPrompt } from "@/lib/ai/system-prompt";
import type { ChatMessage } from "@/lib/ai/types";

/**
 * The investor assistant.
 *
 * STATELESS BY DESIGN. Nothing is written anywhere: there is no chat history
 * table, none is being created, and this handler performs no insert, update or
 * delete on any table. The conversation lives in the client's React state for
 * as long as the panel is open and is gone after that — which is what
 * integrations.md asks for.
 *
 * SECURITY, in one line: identity comes from the session, context comes from
 * identity, and the client supplies neither. See lib/ai/context.ts.
 *
 * AUTH: cookies (web) or `Authorization: Bearer <access_token>` (a future
 * native app). Same endpoint, same checks — see lib/supabase/request.ts.
 *
 * GATING: the investor capability is required. A visitor has no investment data
 * for the assistant to explain, and serving them a public-catalogue-only bot
 * would be a different product with its own copy and its own guardrails; that
 * is a decision to take deliberately, not to fall into. The FAB is not rendered
 * for them either, so this is a second barrier, not the only one.
 */

type ErrorCode =
  | "unauthorized"
  | "forbidden"
  | "invalid"
  | "conversation-limit"
  | "rate-limit"
  | "provider";

function fail(code: ErrorCode, message: string, status: number) {
  return NextResponse.json({ error: message, code }, { status });
}

/** Identity + investor scope, or the response that refuses the request. */
async function authorize(request: Request) {
  const { supabase, token } = await createRequestClient(request);

  const user = await getVerifiedUser(supabase, token ?? undefined);
  if (!user) {
    return {
      denied: fail("unauthorized", es.chat.errors.unauthorized, 401),
    } as const;
  }

  // Derived from auth.uid(), never from the payload.
  const investorIds = await resolveInvestorIds(
    supabase as unknown as ChatContextClient,
    user.id
  );

  if (investorIds.length === 0) {
    return { denied: fail("forbidden", es.chat.errors.forbidden, 403) } as const;
  }

  return { denied: null, supabase, userId: user.id, investorIds } as const;
}

/**
 * Suggestion chips for the empty state.
 *
 * A separate GET so the investor layout does not pay a query on every
 * navigation just in case the panel is opened. It is fetched once, when the
 * panel first opens.
 */
export async function GET(request: Request) {
  const auth = await authorize(request);
  if (auth.denied) return auth.denied;

  const context = await buildInvestorContext(
    auth.supabase as unknown as ChatContextClient,
    auth.investorIds
  );

  const project = primaryProjectName(context);

  return NextResponse.json({
    starters: [
      es.chat.starters.total,
      project
        ? es.chat.starters.project.replace("{project}", project)
        : es.chat.starters.projectFallback,
      es.chat.starters.movements,
    ],
  });
}

export async function POST(request: Request) {
  const auth = await authorize(request);
  if (auth.denied) return auth.denied;

  // The abuse ceiling, before any work is done.
  const verdict = consumeRateLimit(auth.userId);
  if (!verdict.allowed) {
    const response = fail("rate-limit", es.chat.errors.rateLimit, 429);
    response.headers.set("Retry-After", String(verdict.retryAfterSeconds));
    return response;
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail("invalid", es.chat.errors.invalid, 400);
  }

  // Whitelist. Anything resembling an identity or a context is dropped here.
  const parsed = parseChatRequest(body);
  if (!parsed.ok) {
    return fail("invalid", es.chat.errors.invalid, 400);
  }

  const conversation: ChatMessage[] = [
    ...parsed.payload.history,
    { role: "user", content: parsed.payload.message },
  ];

  // Checked BEFORE calling the provider, so a capped conversation costs nothing.
  if (isConversationLimitReached(conversation)) {
    return fail("conversation-limit", es.chat.errors.conversationLimit, 429);
  }

  // Rebuilt fresh on every request: the answer reflects the data as it is now,
  // and a stale context can never outlive a change in the investor's position.
  const context = await buildInvestorContext(
    auth.supabase as unknown as ChatContextClient,
    auth.investorIds
  );

  const result = await generateChatCompletion({
    system: buildSystemPrompt(renderInvestorContext(context)),
    messages: trimHistory(conversation),
  });

  if (result.status === "failed") {
    // The reason is logged by the provider; the user gets Spanish and a retry.
    return fail("provider", es.chat.errors.provider, 502);
  }

  // "unavailable" is a normal answer, not an error: it is what the mock
  // provider replies while no model is connected.
  return NextResponse.json({ reply: result.text });
}
