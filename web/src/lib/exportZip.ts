// "export all photos": one zip with every photo plus a plain manifest.
//
// daily-booth-export/
//   days.json      every day, its status, caption and photos
//   days.csv       the same, one row per photo, for spreadsheets
//   photos/2026-11-22/<id>-film.jpg
//   photos/2026-11-22/<id>-original.jpg
//
// the manifest only uses plain values so any future format (book, video,
// another app) can be built from it.

import { Zip, ZipPassThrough, strToU8 } from "fflate";
import { downloadPhoto, loadAllDays, loadAllPhotos, loadSummaries } from "./api";
import type { Booth } from "./types";

export async function buildExport(booth: Booth, onProgress: (done: number, total: number) => void): Promise<File> {
  const [days, photos] = await Promise.all([loadAllDays(), loadAllPhotos()]);
  const first = days[0]?.local_date ?? "2000-01-01";
  const last = days[days.length - 1]?.local_date ?? "2000-01-01";
  const summaries = await loadSummaries(first, last);
  const statusById = new Map(summaries.map((s) => [s.id, s.status]));

  const names: Record<string, string> = { [booth.me.user_id]: booth.me.display_name };
  if (booth.partner) names[booth.partner.user_id] = booth.partner.display_name;

  const folder = "daily-booth-export";
  const fileName = (path: string) => `photos/${path.split("/").slice(1).join("/")}`;

  const manifest = days.map((d) => ({
    date: d.local_date,
    mode: d.mode ?? "together",
    status: statusById.get(d.id) ?? "pending",
    caption: d.caption,
    ping_at: d.ping_at,
    photos: photos
      .filter((p) => p.day_id === d.id)
      .map((p) => ({
        id: p.id,
        taken_by: names[p.taken_by] ?? p.taken_by,
        taken_at: p.taken_at,
        film: p.film,
        date_stamp: p.date_stamp,
        film_file: fileName(p.film_path),
        original_file: fileName(p.original_path),
      })),
  }));

  const csvRows = [["date", "mode", "status", "caption", "taken_by", "taken_at", "film", "film_file", "original_file"]];
  for (const day of manifest) {
    if (day.photos.length === 0) {
      csvRows.push([day.date, day.mode, day.status, day.caption ?? "", "", "", "", "", ""]);
    }
    for (const p of day.photos) {
      csvRows.push([day.date, day.mode, day.status, day.caption ?? "", p.taken_by, p.taken_at, p.film, p.film_file, p.original_file]);
    }
  }
  const csv = csvRows.map((r) => r.map(csvCell).join(",")).join("\n");

  const chunks: Uint8Array[] = [];
  const zip = new Zip((err, chunk) => {
    if (err) throw err;
    chunks.push(chunk);
  });
  const add = (name: string, data: Uint8Array) => {
    const entry = new ZipPassThrough(`${folder}/${name}`);
    zip.add(entry);
    entry.push(data, true);
  };

  add("days.json", strToU8(JSON.stringify({ exported_at: new Date().toISOString(), days: manifest }, null, 2)));
  add("days.csv", strToU8(csv));

  const paths = photos.flatMap((p) => [p.film_path, p.original_path]);
  let done = 0;
  onProgress(done, paths.length);
  for (const path of paths) {
    const blob = await downloadPhoto(path);
    add(fileName(path), new Uint8Array(await blob.arrayBuffer()));
    onProgress(++done, paths.length);
  }
  zip.end();

  return new File(chunks as BlobPart[], `daily-booth-${new Date().toISOString().slice(0, 10)}.zip`, { type: "application/zip" });
}

function csvCell(value: string) {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}
