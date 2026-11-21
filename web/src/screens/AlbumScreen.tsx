import { useEffect, useState } from "react";
import { loadPhotos, loadSummaries, photoUrls } from "../lib/api";
import { localDate, monthBounds, monthName } from "../lib/dates";
import type { Booth, DaySummary, Photo } from "../lib/types";
import { Icon } from "../components/Icon";

interface Cell {
  date: string;
  n: number;
  kind: "photo" | "missed" | "future" | "before" | "pending";
  thumbs: (string | null)[]; // one url (together) or two slots (apart)
  label: string;
}

export function AlbumScreen({ booth, onOpenDay }: { booth: Booth; onOpenDay: (date: string) => void }) {
  const tz = booth.couple.timezone;
  const today = localDate(tz);
  const [ym, setYm] = useState(() => ({ y: Number(today.slice(0, 4)), m: Number(today.slice(5, 7)) }));
  const [cells, setCells] = useState<Cell[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { first, last, lastDay, firstWeekday } = monthBounds(ym.y, ym.m);
  const startedOn = localDate(tz, new Date(booth.couple.created_at));
  const canGoBack = first > startedOn;
  const canGoForward = last < today;

  useEffect(() => {
    let cancelled = false;
    setCells(null);
    (async () => {
      try {
        const summaries = await loadSummaries(first, last);
        const photos = await loadPhotos(summaries.map((s) => s.id));
        const urls = await photoUrls(photos.map((p) => p.film_path));
        if (cancelled) return;
        setCells(buildCells({ first, lastDay, today, startedOn, summaries, photos, urls, me: booth.userId }));
        setError(null);
      } catch (err) {
        if (!cancelled) setError((err as Error).message.toLowerCase());
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [first, last, lastDay, today, startedOn, booth.userId]);

  function shift(by: number) {
    const d = new Date(Date.UTC(ym.y, ym.m - 1 + by, 1));
    setYm({ y: d.getUTCFullYear(), m: d.getUTCMonth() + 1 });
  }

  return (
    <div className="screen__body">
      <header className="screen__header">
        <h1 className="screen__title">
          {monthName(ym.y, ym.m)}
          {ym.y !== Number(today.slice(0, 4)) && <span className="faint"> {ym.y}</span>}
        </h1>
        <div style={{ display: "flex" }}>
          <button className="icon-button" type="button" aria-label="previous month" onClick={() => shift(-1)} disabled={!canGoBack}>
            <Icon name="back" size={20} />
          </button>
          <button className="icon-button" type="button" aria-label="next month" onClick={() => shift(1)} disabled={!canGoForward}>
            <Icon name="forward" size={20} />
          </button>
        </div>
      </header>

      <div className="album__weekdays" aria-hidden="true">
        {["s", "m", "t", "w", "t", "f", "s"].map((d, i) => (
          <span key={i}>{d}</span>
        ))}
      </div>

      {error && <p className="error">{error}</p>}
      {!cells && !error && <p className="spinner">developing…</p>}

      {cells && (
        <div className="album__grid">
          {Array.from({ length: firstWeekday }, (_, i) => (
            <span key={`pad-${i}`} />
          ))}
          {cells.map((c) => (
            <button
              key={c.date}
              type="button"
              aria-label={c.label}
              disabled={c.kind !== "photo"}
              onClick={() => onOpenDay(c.date)}
              className={[
                "album__cell",
                `album__cell--${c.kind}`,
                c.date === today ? "album__cell--today" : "",
              ].join(" ")}
            >
              <span className="album__thumb">
                {c.thumbs.map((url, i) => (
                  <span key={i} className={url ? "" : c.kind === "photo" ? "empty" : ""} style={url ? { backgroundImage: `url("${url}")` } : { background: "transparent" }} />
                ))}
              </span>
              <span className="album__num">{c.n}</span>
            </button>
          ))}
        </div>
      )}

      <p className="album__key">
        split prints are apart days. a half-empty print means only one of you posted. outlines are missed days.
      </p>
    </div>
  );
}

function buildCells(args: {
  first: string;
  lastDay: number;
  today: string;
  startedOn: string;
  summaries: DaySummary[];
  photos: Photo[];
  urls: Record<string, string>;
  me: string;
}): Cell[] {
  const { first, lastDay, today, startedOn, summaries, photos, urls, me } = args;
  const byDate = new Map(summaries.map((s) => [s.local_date, s]));
  const prefix = first.slice(0, 8);
  const cells: Cell[] = [];

  for (let n = 1; n <= lastDay; n++) {
    const date = `${prefix}${String(n).padStart(2, "0")}`;
    const s = byDate.get(date);
    const dayPhotos = s ? photos.filter((p) => p.day_id === s.id) : [];
    const lastOf = (list: Photo[]) => list[list.length - 1];

    if (date > today) {
      cells.push({ date, n, kind: "future", thumbs: [], label: `${date}, upcoming` });
    } else if (date < startedOn) {
      cells.push({ date, n, kind: "before", thumbs: [], label: `${date}, before your booth started` });
    } else if (dayPhotos.length === 0) {
      const kind = date === today ? "pending" : "missed";
      cells.push({ date, n, kind, thumbs: [], label: `${date}, ${kind === "missed" ? "missed" : "no photo yet"}` });
    } else if (s?.mode === "apart") {
      const mine = lastOf(dayPhotos.filter((p) => p.taken_by === me));
      const theirs = lastOf(dayPhotos.filter((p) => p.taken_by !== me));
      cells.push({
        date, n, kind: "photo",
        thumbs: [mine ? urls[mine.film_path] ?? null : null, theirs ? urls[theirs.film_path] ?? null : null],
        label: `${date}, apart${mine && theirs ? "" : ", only one of you posted"}`,
      });
    } else {
      const p = lastOf(dayPhotos);
      cells.push({ date, n, kind: "photo", thumbs: [urls[p.film_path] ?? null], label: `${date}, together` });
    }
  }
  return cells;
}
