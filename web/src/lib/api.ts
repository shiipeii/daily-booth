// every read and write to the backend goes through this file.
// if you ever move off supabase, this is the one file to rewrite.

import { supabase, PHOTO_BUCKET } from "./supabase";
import type { Booth, Couple, Day, DaySummary, Film, Member, Mode, Photo } from "./types";

function unwrap<T>(result: { data: T | null; error: { message: string } | null }): T {
  if (result.error) throw new Error(result.error.message);
  return result.data as T;
}

// auth ------------------------------------------------------------------------

export async function signUp(email: string, password: string) {
  const { error } = await supabase.auth.signUp({ email, password });
  if (error) throw new Error(error.message);
}

export async function signIn(email: string, password: string) {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error(error.message);
}

export async function signOut() {
  await supabase.auth.signOut();
}

export async function currentUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.user.id ?? null;
}

// booth (couple + members) ------------------------------------------------------

export async function loadBooth(userId: string): Promise<Booth | null> {
  const members = unwrap<Member[]>(
    await supabase.from("members").select("user_id, couple_id, display_name"),
  );
  const me = members.find((m) => m.user_id === userId);
  if (!me) return null;
  const couple = unwrap<Couple>(
    await supabase.from("couples").select("*").eq("id", me.couple_id).single(),
  );
  const partner = members.find((m) => m.user_id !== userId) ?? null;
  return { userId, me, partner, couple };
}

export async function createCouple(displayName: string) {
  unwrap(await supabase.rpc("create_couple", { p_display_name: displayName }));
}

export async function joinCouple(code: string, displayName: string) {
  unwrap(await supabase.rpc("join_couple", { p_code: code, p_display_name: displayName }));
}

export async function renameMe(userId: string, displayName: string) {
  unwrap(
    await supabase.from("members").update({ display_name: displayName }).eq("user_id", userId),
  );
}

export async function updatePingWindow(coupleId: string, start: number, end: number) {
  unwrap(
    await supabase
      .from("couples")
      .update({ ping_window_start: start, ping_window_end: end })
      .eq("id", coupleId),
  );
}

// days ------------------------------------------------------------------------------

export async function loadToday(): Promise<Day> {
  return unwrap<Day>(await supabase.rpc("today"));
}

export async function setMode(dayId: string, mode: Mode) {
  unwrap(await supabase.from("days").update({ mode }).eq("id", dayId));
}

export async function setCaption(dayId: string, caption: string) {
  unwrap(
    await supabase
      .from("days")
      .update({ caption: caption.trim() || null })
      .eq("id", dayId),
  );
}

/** summaries for days in [from, to], inclusive, as yyyy-mm-dd */
export async function loadSummaries(from: string, to: string): Promise<DaySummary[]> {
  return unwrap<DaySummary[]>(
    await supabase
      .from("day_summary")
      .select("*")
      .gte("local_date", from)
      .lte("local_date", to)
      .order("local_date"),
  );
}

// photos ---------------------------------------------------------------------------

export async function loadPhotos(dayIds: string[]): Promise<Photo[]> {
  if (dayIds.length === 0) return [];
  return unwrap<Photo[]>(
    await supabase.from("photos").select("*").in("day_id", dayIds).order("taken_at"),
  );
}

export async function loadAllPhotos(): Promise<Photo[]> {
  return unwrap<Photo[]>(await supabase.from("photos").select("*").order("taken_at"));
}

export async function loadAllDays(): Promise<Day[]> {
  return unwrap<Day[]>(await supabase.from("days").select("*").order("local_date"));
}

export interface NewPhoto {
  day: Day;
  userId: string;
  film: Film;
  dateStamp: boolean;
  original: Blob;
  print: Blob;
  width: number;
  height: number;
}

export async function addPhoto(p: NewPhoto): Promise<Photo> {
  const id = crypto.randomUUID();
  const folder = `${p.day.couple_id}/${p.day.local_date}`;
  const originalPath = `${folder}/${id}-original.jpg`;
  const filmPath = `${folder}/${id}-film.jpg`;

  const bucket = supabase.storage.from(PHOTO_BUCKET);
  unwrap(await bucket.upload(originalPath, p.original, { contentType: "image/jpeg" }));
  unwrap(await bucket.upload(filmPath, p.print, { contentType: "image/jpeg" }));

  return unwrap<Photo>(
    await supabase
      .from("photos")
      .insert({
        id,
        day_id: p.day.id,
        couple_id: p.day.couple_id,
        taken_by: p.userId,
        film: p.film,
        date_stamp: p.dateStamp,
        original_path: originalPath,
        film_path: filmPath,
        width: p.width,
        height: p.height,
      })
      .select()
      .single(),
  );
}

export async function deletePhoto(photo: Photo) {
  unwrap(await supabase.from("photos").delete().eq("id", photo.id));
  await supabase.storage.from(PHOTO_BUCKET).remove([photo.original_path, photo.film_path]);
}

// signed urls are cached for the session so the album doesn't refetch them
const urlCache = new Map<string, { url: string; expires: number }>();
const URL_TTL_SECONDS = 60 * 60;

export async function photoUrls(paths: string[]): Promise<Record<string, string>> {
  const now = Date.now();
  const missing = paths.filter((p) => {
    const hit = urlCache.get(p);
    return !hit || hit.expires < now;
  });
  if (missing.length > 0) {
    const signed = unwrap<{ path: string | null; signedUrl: string | null }[]>(
      await supabase.storage.from(PHOTO_BUCKET).createSignedUrls(missing, URL_TTL_SECONDS),
    );
    for (const s of signed) {
      if (s.path && s.signedUrl) urlCache.set(s.path, { url: s.signedUrl, expires: now + (URL_TTL_SECONDS - 60) * 1000 });
    }
  }
  const out: Record<string, string> = {};
  for (const p of paths) {
    const hit = urlCache.get(p);
    if (hit) out[p] = hit.url;
  }
  return out;
}

export async function downloadPhoto(path: string): Promise<Blob> {
  return unwrap<Blob>(await supabase.storage.from(PHOTO_BUCKET).download(path));
}

// push --------------------------------------------------------------------------------

export async function vapidPublicKey(): Promise<string | null> {
  const rows = unwrap<{ value: string }[]>(
    await supabase.from("app_config").select("value").eq("key", "vapid_public_key"),
  );
  return rows[0]?.value ?? null;
}

export async function savePushSubscription(userId: string, sub: PushSubscription) {
  const json = sub.toJSON();
  unwrap(
    await supabase.from("push_subscriptions").upsert({
      endpoint: sub.endpoint,
      user_id: userId,
      p256dh: json.keys?.p256dh ?? "",
      auth: json.keys?.auth ?? "",
    }),
  );
}

export async function removePushSubscription(endpoint: string) {
  unwrap(await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint));
}
