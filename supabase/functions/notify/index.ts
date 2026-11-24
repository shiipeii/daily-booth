// notify: called by a database trigger when someone posts their selfie on an
// apart day (see migrations/*_selfie_notify.sql). tells the other person.
//
//   ian posts first   -> you get "ian took today's selfie. your turn…"
//   ian posts second  -> you get "ian posted. today's strip is done."

import { adminClient, isAuthorized, json, sendToUsers } from "../_shared/push.ts";

Deno.serve(async (req) => {
  if (!isAuthorized(req)) return new Response("unauthorized", { status: 401 });
  const { photo_id: photoId } = await req.json().catch(() => ({}));
  if (!photoId) return json({ error: "photo_id missing" }, 400);

  const db = adminClient();

  const { data: photo } = await db
    .from("photos")
    .select("id, day_id, couple_id, taken_by")
    .eq("id", photoId)
    .maybeSingle();
  if (!photo) return json({ skipped: "photo not found" });

  const [{ data: day }, { data: members }, { data: dayPhotos }] = await Promise.all([
    db.from("days").select("mode").eq("id", photo.day_id).single(),
    db.from("members").select("user_id, display_name").eq("couple_id", photo.couple_id),
    db.from("photos").select("taken_by").eq("day_id", photo.day_id),
  ]);
  if (day?.mode !== "apart") return json({ skipped: "not an apart day" });

  const poster = members?.find((m) => m.user_id === photo.taken_by);
  const others = (members ?? []).filter((m) => m.user_id !== photo.taken_by);
  const posted = new Set((dayPhotos ?? []).map((p) => p.taken_by));
  const name = poster?.display_name?.toLowerCase() ?? "your person";

  let sent = 0;
  for (const other of others) {
    const message = posted.has(other.user_id)
      ? { title: "daily booth", body: `${name} posted. today's strip is done.` }
      : { title: "daily booth", body: `${name} took today's selfie. your turn, you have until midnight.` };
    sent += (await sendToUsers(db, [other.user_id], message)).sent;
  }
  return json({ sent });
});
