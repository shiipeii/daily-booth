// shared by the edge functions: auth check, admin db client, and sending
// web push to a set of users (dropping subscriptions that no longer exist).
//
// env (set by scripts/provision.sh):
//   CRON_SECRET, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT
// provided by supabase automatically:
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2.45.4";
import webpush from "npm:web-push@3.6.7";

export interface PushMessage {
  title: string;
  body: string;
  url?: string;
  [key: string]: unknown;
}

/** only pg_cron and database triggers know this secret */
export function isAuthorized(req: Request): boolean {
  return req.headers.get("x-cron-secret") === Deno.env.get("CRON_SECRET");
}

export function adminClient(): SupabaseClient {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false },
  });
}

let vapidReady = false;

export async function sendToUsers(
  db: SupabaseClient,
  userIds: string[],
  message: PushMessage,
): Promise<{ sent: number; removed: number }> {
  if (userIds.length === 0) return { sent: 0, removed: 0 };
  if (!vapidReady) {
    webpush.setVapidDetails(
      Deno.env.get("VAPID_SUBJECT") ?? "mailto:hello@example.com",
      Deno.env.get("VAPID_PUBLIC_KEY")!,
      Deno.env.get("VAPID_PRIVATE_KEY")!,
    );
    vapidReady = true;
  }

  const { data: subs } = await db
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth")
    .in("user_id", userIds);

  let sent = 0;
  let removed = 0;
  for (const sub of subs ?? []) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify({ url: "./", ...message }),
        { TTL: 60 * 60, urgency: "high" },
      );
      sent++;
    } catch (err) {
      const status = (err as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) {
        // the phone unsubscribed or reinstalled; forget this endpoint
        await db.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
        removed++;
      } else {
        console.error("push failed", status, (err as Error).message);
      }
    }
  }
  return { sent, removed };
}

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}
