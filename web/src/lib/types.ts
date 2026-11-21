// shapes of the rows the app reads. mirrors supabase/migrations/*_schema.sql.

export type Mode = "together" | "apart";
export type Film = "warm" | "faded" | "mono";
export type DayStatus = "pending" | "together" | "apart" | "waiting" | "half" | "missed";

export interface Couple {
  id: string;
  invite_code: string;
  timezone: string;
  ping_window_start: number;
  ping_window_end: number;
  created_at: string;
}

export interface Member {
  user_id: string;
  couple_id: string;
  display_name: string;
}

export interface Day {
  id: string;
  couple_id: string;
  local_date: string; // yyyy-mm-dd
  ping_at: string;
  ping_sent_at: string | null;
  mode: Mode | null;
  caption: string | null;
}

export interface DaySummary extends Omit<Day, "mode"> {
  mode: Mode;
  photo_count: number;
  taker_count: number;
  status: DayStatus;
}

export interface Photo {
  id: string;
  day_id: string;
  couple_id: string;
  taken_by: string;
  taken_at: string;
  film: Film;
  date_stamp: boolean;
  original_path: string;
  film_path: string;
  width: number | null;
  height: number | null;
}

/** everything the signed-in person needs to know about their booth */
export interface Booth {
  userId: string;
  me: Member;
  partner: Member | null;
  couple: Couple;
}

export type CameraRollChoice = "film" | "original" | "both" | "none";
