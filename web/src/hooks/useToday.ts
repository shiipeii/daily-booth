import { useCallback, useEffect, useState } from "react";
import { loadPhotos, loadSummaries, loadToday, photoUrls } from "../lib/api";
import { addDays } from "../lib/dates";
import type { Day, DaySummary, Photo } from "../lib/types";

export interface TodayData {
  day: Day;
  photos: Photo[];
  urls: Record<string, string>;
  streak: number;
}

const REFRESH_MS = 20_000;
const COUNTED: DaySummary["status"][] = ["together", "apart", "half", "waiting"];

/** today's row, its photos and the current streak. refreshes on focus and every 20s. */
export function useToday(enabled: boolean) {
  const [data, setData] = useState<TodayData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const day = await loadToday();
      const [photos, summaries] = await Promise.all([
        loadPhotos([day.id]),
        loadSummaries(addDays(day.local_date, -120), day.local_date),
      ]);
      const urls = await photoUrls(photos.map((p) => p.film_path));
      setData({ day, photos, urls, streak: streak(day.local_date, summaries) });
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;
    refresh();
    const onVisible = () => document.visibilityState === "visible" && refresh();
    document.addEventListener("visibilitychange", onVisible);
    const timer = setInterval(refresh, REFRESH_MS);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      clearInterval(timer);
    };
  }, [enabled, refresh]);

  return { data, error, refresh };
}

/** consecutive days with at least one photo. today only counts once it has one. */
function streak(today: string, summaries: DaySummary[]): number {
  const byDate = new Map(summaries.map((s) => [s.local_date, s.status]));
  let count = 0;
  let date = today;
  if (!COUNTED.includes(byDate.get(today) ?? "pending")) date = addDays(today, -1);
  while (COUNTED.includes(byDate.get(date) ?? "missed")) {
    count++;
    date = addDays(date, -1);
  }
  return count;
}
