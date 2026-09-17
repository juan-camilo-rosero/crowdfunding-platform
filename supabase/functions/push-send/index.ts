/**
 * push-send — the ONLY place that talks to Expo.
 *
 * A Database Webhook fires this function on every INSERT into
 * public.notifications. It looks up the recipient's devices in
 * public.push_tokens and hands the message to the Expo Push API. Both senders
 * in the web app (the admin panel and the new-project trigger) simply insert a
 * row, so delivery has one implementation and one place to debug.
 *
 * DEPLOY
 *   supabase functions deploy push-send
 *   supabase secrets set EXPO_ACCESS_TOKEN=...   # expo.dev -> Access Tokens
 * SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are injected by the platform.
 *
 * Runs on Deno, outside the Next.js build. It is deliberately dependency-light:
 * the Supabase JS client is the only import.
 */
import { createClient } from "jsr:@supabase/supabase-js@2";

const EXPO_PUSH_ENDPOINT = "https://exp.host/--/api/v2/push/send";

/**
 * Expo's documented ceiling for one request. Today a notification usually
 * reaches one or two devices, but the same function serves any fan-out the
 * platform grows into, so the batching is real rather than assumed away.
 */
const MAX_RECIPIENTS_PER_REQUEST = 100;

type NotificationRecord = {
  id: string;
  user_id: string;
  title: string;
  body: string;
  data: Record<string, unknown> | null;
};

type WebhookPayload = {
  type: "INSERT" | "UPDATE" | "DELETE";
  table: string;
  schema: string;
  record: NotificationRecord | null;
};

type ExpoTicket = {
  status: "ok" | "error";
  id?: string;
  message?: string;
  details?: { error?: string };
};

const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const EXPO_ACCESS_TOKEN = Deno.env.get("EXPO_ACCESS_TOKEN") ?? "";

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/**
 * Compares without leaking length or position through timing. Cheap insurance:
 * this is the single check standing between the public internet and the power
 * to push a notification to somebody else's phone.
 */
function secretsMatch(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

Deno.serve(async (request: Request): Promise<Response> => {
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  // AUTHORISATION. The function is deployed with verify_jwt = false on purpose:
  // that setting accepts ANY valid project JWT, which includes every signed-in
  // investor's token — and this endpoint decides whose phone rings. Requiring
  // the service key instead means only the Database Webhook can call it.
  const authorization = request.headers.get("Authorization") ?? "";
  const bearer = authorization.replace(/^Bearer\s+/i, "");

  if (!SERVICE_ROLE_KEY || !secretsMatch(bearer, SERVICE_ROLE_KEY)) {
    return json({ error: "Unauthorized" }, 401);
  }

  if (!EXPO_ACCESS_TOKEN) {
    // Configuration error, not a bad request: say so loudly rather than
    // dropping the notification silently.
    console.error("EXPO_ACCESS_TOKEN is not set; cannot deliver notifications.");
    return json({ error: "EXPO_ACCESS_TOKEN is not configured" }, 500);
  }

  let payload: WebhookPayload;
  try {
    payload = await request.json();
  } catch {
    return json({ error: "Invalid JSON payload" }, 400);
  }

  // The webhook is scoped to INSERT on notifications, but the function must not
  // depend on the dashboard staying configured that way.
  if (payload.type !== "INSERT" || payload.table !== "notifications") {
    return json({ skipped: "not a notifications insert" });
  }

  const record = payload.record;
  if (!record?.user_id) {
    return json({ error: "Payload has no notification record" }, 400);
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: tokens, error } = await supabase
    .from("push_tokens")
    .select("token")
    .eq("user_id", record.user_id);

  if (error) {
    console.error("Could not read push_tokens:", error.message);
    return json({ error: "Could not read push tokens" }, 500);
  }

  // Nobody has the app installed yet. The notification still exists in the
  // feed, so this is a normal outcome, not a failure.
  if (!tokens || tokens.length === 0) {
    return json({ sent: 0, reason: "no registered devices" });
  }

  const pushTokens = tokens.map((row: { token: string }) => row.token);

  /** Tokens Expo reported as belonging to an uninstalled or wiped app. */
  const staleTokens: string[] = [];
  let sent = 0;
  let failed = 0;

  for (const batch of chunk(pushTokens, MAX_RECIPIENTS_PER_REQUEST)) {
    const messages = batch.map((token) => ({
      to: token,
      sound: "default",
      title: record.title,
      body: record.body,
      // What the app uses to route the tap (e.g. type: "project_created").
      data: record.data ?? {},
    }));

    const response = await fetch(EXPO_PUSH_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${EXPO_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
        Accept: "application/json",
        "Accept-Encoding": "gzip, deflate",
      },
      body: JSON.stringify(messages),
    });

    if (!response.ok) {
      // A whole batch rejected: wrong token, rate limit, Expo down. Logged and
      // counted; the row stays in the feed either way.
      failed += batch.length;
      console.error(
        `Expo rejected a batch (${response.status}):`,
        await response.text()
      );
      continue;
    }

    const result = (await response.json()) as {
      data?: ExpoTicket[];
      errors?: unknown[];
    };

    if (result.errors) {
      failed += batch.length;
      console.error("Expo returned request-level errors:", result.errors);
      continue;
    }

    // Tickets come back in the same order as the messages sent, which is the
    // only way to tell WHICH token an error belongs to.
    (result.data ?? []).forEach((ticket, index) => {
      if (ticket.status === "ok") {
        sent += 1;
        return;
      }

      failed += 1;

      if (ticket.details?.error === "DeviceNotRegistered") {
        staleTokens.push(batch[index]);
        return;
      }

      console.error(`Expo error for a device: ${ticket.message ?? "unknown"}`);
    });
  }

  // The app was uninstalled or the token was invalidated. Keeping these rows
  // means every future notification pays for a delivery that cannot succeed,
  // and Expo penalises senders that keep pushing to dead tokens.
  if (staleTokens.length > 0) {
    const { error: deleteError } = await supabase
      .from("push_tokens")
      .delete()
      .in("token", staleTokens);

    if (deleteError) {
      console.error("Could not prune stale tokens:", deleteError.message);
    }
  }

  return json({
    notification_id: record.id,
    devices: pushTokens.length,
    sent,
    failed,
    pruned: staleTokens.length,
  });
});
