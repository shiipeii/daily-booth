// tick: runs every minute (pg_cron -> this function).
//
// 1. makes sure every couple has a row for today, with a random ping time
// 2. sends the daily ping for any day whose ping time has passed, skipping
//    anyone who already took the day's photo (together day: any photo
//    skips everyone; apart day: only people who haven't posted get it)

import { adminClient, isAuthorized, json, sendToUsers } from "../_shared/push.ts";

const PING_MESSAGE = {
  title: "daily booth",
  body: "time for today's photo. together or apart, you have until midnight.",
};

Deno.serve(async (req) => {
  if (!isAuthorized(req)) return new Response("unauthorized", { status: 401 });
  const db = adminClient();

  const { error: ensureError } = await db.rpc("ensure_all_days");
  if (ensureError) return json({ error: ensureError.message }, 500);

  // claim due days atomically so a slow run never double-sends
  const { data: claimed, error: claimError } = await db
    .from("days")
    .update({ ping_sent_at: new Date().toISOString() })
    .is("ping_sent_at", null)
    .lte("ping_at", new Date().toISOString())
    .select("id, couple_id, mode");
  if (claimError) return json({ error: claimError.message }, 500);

  let sent = 0;
  let removed = 0;

  for (const day of claimed ?? []) {
    const [{ data: members }, { data: photos }] = await Promise.all([
      db.from("members").select("user_id").eq("couple_id", day.couple_id),
      db.from("photos").select("taken_by").eq("day_id", day.id),
    ]);
    const posted = new Set((photos ?? []).map((p) => p.taken_by));
    const together = day.mode !== "apart";
    if (together && posted.size > 0) continue; // today's photo is already in

    const userIds = (members ?? []).map((m) => m.user_id).filter((id) => !posted.has(id));
    const result = await sendToUsers(db, userIds, { ...PING_MESSAGE, dayId: day.id });
    sent += result.sent;
    removed += result.removed;
  }

  return json({ days: claimed?.length ?? 0, sent, removed });
});
