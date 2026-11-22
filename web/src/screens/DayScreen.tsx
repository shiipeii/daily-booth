import { useEffect, useState } from "react";
import { deletePhoto, downloadPhoto, loadPhotos, loadSummaries, photoUrls } from "../lib/api";
import { saveToCameraRoll } from "../lib/cameraRoll";
import { clockTime, longDate } from "../lib/dates";
import type { Booth, DaySummary, Photo } from "../lib/types";
import { Icon } from "../components/Icon";
import { PrintImage } from "../components/Print";

interface Loaded {
  summary: DaySummary;
  photos: Photo[];
  urls: Record<string, string>;
  blobs: Record<string, Blob>; // pre-fetched so "save" can open the share sheet instantly
}

export function DayScreen({ booth, date, onBack, onChanged }: { booth: Booth; date: string; onBack: () => void; onChanged: (message: string) => void }) {
  const [data, setData] = useState<Loaded | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [summary] = await loadSummaries(date, date);
        if (!summary) throw new Error("nothing on this day");
        const photos = await loadPhotos([summary.id]);
        const urls = await photoUrls(photos.map((p) => p.film_path));
        if (cancelled) return;
        setData({ summary, photos, urls, blobs: {} });
        // fetch full files in the background for saving
        const entries = await Promise.all(
          photos.flatMap((p) => [p.film_path, p.original_path]).map(async (path) => [path, await downloadPhoto(path)] as const),
        );
        if (!cancelled) setData((d) => (d ? { ...d, blobs: Object.fromEntries(entries) } : d));
      } catch (err) {
        if (!cancelled) setError((err as Error).message.toLowerCase());
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [date]);

  const nameOf = (userId: string) =>
    userId === booth.userId ? "you" : booth.partner?.user_id === userId ? booth.partner.display_name : "someone";

  function save(photo: Photo, which: "film" | "original") {
    const path = which === "film" ? photo.film_path : photo.original_path;
    const blob = data?.blobs[path];
    if (!blob) return;
    const name = `daily-booth-${date}${which === "original" ? "-original" : ""}.jpg`;
    saveToCameraRoll([new File([blob], name, { type: "image/jpeg" })]);
  }

  async function remove(photo: Photo) {
    if (confirmDelete !== photo.id) {
      setConfirmDelete(photo.id);
      return;
    }
    await deletePhoto(photo);
    onChanged("photo removed");
  }

  // show the latest photo per person
  const shown = data
    ? Object.values(
        data.photos.reduce<Record<string, Photo>>((acc, p) => ({ ...acc, [p.taken_by]: p }), {}),
      )
    : [];

  return (
    <main className="screen">
      <header className="screen__header" style={{ justifyContent: "flex-start" }}>
        <button className="icon-button" type="button" aria-label="back" onClick={onBack}>
          <Icon name="back" />
        </button>
        <h1 className="screen__subtitle">{longDate(date)}</h1>
      </header>

      {error && <p className="error">{error}</p>}
      {!data && !error && <p className="spinner">developing…</p>}

      {data && (
        <div className="screen__body">
          {data.summary.caption && <p className="day__caption">“{data.summary.caption}”</p>}
          <div className="day__prints">
            {shown.map((p) => (
              <figure key={p.id} style={{ margin: 0, width: "min(300px, 78vw)" }}>
                <PrintImage src={data.urls[p.film_path]} alt={`photo by ${nameOf(p.taken_by)}`} />
                <figcaption className="day__meta">
                  {nameOf(p.taken_by)} at {clockTime(p.taken_at, booth.couple.timezone)}
                </figcaption>
                <div style={{ display: "flex", justifyContent: "center", gap: 12, flexWrap: "wrap", marginTop: 4 }}>
                  <button className="link" type="button" onClick={() => save(p, "film")} disabled={!data.blobs[p.film_path]}>
                    save film
                  </button>
                  <button className="link" type="button" onClick={() => save(p, "original")} disabled={!data.blobs[p.original_path]}>
                    save original
                  </button>
                  {p.taken_by === booth.userId && (
                    <button className="link" type="button" style={{ color: "var(--danger)" }} onClick={() => remove(p)}>
                      {confirmDelete === p.id ? "tap again to remove" : "remove"}
                    </button>
                  )}
                </div>
              </figure>
            ))}
          </div>
        </div>
      )}
    </main>
  );
}
