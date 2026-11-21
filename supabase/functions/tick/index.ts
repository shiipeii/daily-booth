// tick: runs every minute (pg_cron -> this function).
//
// 1. makes sure every couple has a row for today, with a random ping time
// 2. sends the web push for any day whose ping time has passed
//
// env (set by scripts/provision.sh):
//   CRON_SECRET, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT
// provided by supabase automatically:
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

import { createClient } from "npm:@supabase/supabase-js@2.45.4";
import webpush from "npm:web-push@3.6.7";

const PING_MESSAGE = {
  title: "daily booth",
  body: "time for today's photo. together or apart, you've got 5 minutes.",
  url: "./",
};

Deno.serve(async (req) => {
  if (req.headers.get("x-cron-secret") !== Deno.env.get("CRON_SECRET")) {
    return new Response("unauthorized", { status: 401 });
  }

  const db = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  webpush.setVapidDetails(
    Deno.env.get("VAPID_SUBJECT") ?? "mailto:hello@example.com",
    Deno.env.get("VAPID_PUBLIC_KEY")!,
    Deno.env.get("VAPID_PRIVATE_KEY")!,
  );

  const { error: ensureError } = await db.rpc("ensure_all_days");
  if (ensureError) return json({ error: ensureError.message }, 500);

  // claim due days atomically so a slow run never double-sends
  const { data: claimed, error: claimError } = await db
    .from("days")
    .update({ ping_sent_at: new Date().toISOString() })
    .is("ping_sent_at", null)
    .lte("ping_at", new Date().toISOString())
    .select("id, couple_id");
  if (claimError) return json({ error: claimError.message }, 500);

  let sent = 0;
  let removed = 0;

  for (const day of claimed ?? []) {
    const { data: members } = await db
      .from("members")
      .select("user_id")
      .eq("couple_id", day.couple_id);
    const userIds = (members ?? []).map((m) => m.user_id);
    if (userIds.length === 0) continue;

    const { data: subs } = await db
      .from("push_subscriptions")
      .select("endpoint, p256dh, auth")
      .in("user_id", userIds);

    for (const sub of subs ?? []) {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify({ ...PING_MESSAGE, dayId: day.id }),
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
  }

  return json({ days: claimed?.length ?? 0, sent, removed });
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}
