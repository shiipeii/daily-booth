import { setMode } from "../lib/api";
import { hourLabel, printDate } from "../lib/dates";
import type { PushState } from "../lib/push";
import type { Booth, Mode, Photo } from "../lib/types";
import type { TodayData } from "../hooks/useToday";
import { Icon } from "../components/Icon";
import { Print, PrintImage, PrintPhoto } from "../components/Print";
import { Segmented } from "../components/Segmented";

interface Props {
  booth: Booth;
  today: TodayData | null;
  error: string | null;
  pushState: PushState;
  onRefresh: () => void;
  onOpenCamera: (mode: Mode) => void;
  onOpenDay: (date: string) => void;
  onOpenSettings: () => void;
}

export function TodayScreen({ booth, today, error, pushState, onRefresh, onOpenCamera, onOpenDay, onOpenSettings }: Props) {
  if (!today) {
    return (
      <div className="screen__body">
        <Header streak={null} onOpenSettings={onOpenSettings} />
        <p className="spinner">{error ? error.toLowerCase() : "developing…"}</p>
      </div>
    );
  }

  const { day, photos, urls, streak } = today;
  const mode: Mode = day.mode ?? "together";
  const partnerName = booth.partner?.display_name ?? "your person";
  const mine = latest(photos.filter((p) => p.taken_by === booth.userId));
  const theirs = latest(photos.filter((p) => p.taken_by !== booth.userId));
  const anyPhoto = latest(photos);

  // the ping counts as "arrived" once the server sent it, or once its time has passed.
  // after that there's no timer: you have until midnight.
  const arrivedAt = day.ping_sent_at ?? (new Date(day.ping_at).getTime() <= Date.now() ? day.ping_at : null);

  async function chooseMode(next: Mode) {
    await setMode(day.id, next);
    onRefresh();
  }

  return (
    <div className="screen__body">
      <Header streak={streak} onOpenSettings={onOpenSettings} />

      {/* the print */}
      {mode === "together" && anyPhoto ? (
        <button className="today__print" type="button" onClick={() => onOpenDay(day.local_date)} aria-label="open today's photo">
          <PrintImage src={urls[anyPhoto.film_path]} alt="today's photo" />
        </button>
      ) : mode === "apart" && anyPhoto ? (
        <button className="today__print" type="button" onClick={() => onOpenDay(day.local_date)} aria-label="open today's photos" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Half photo={mine} url={mine && urls[mine.film_path]} label="you" waiting="you haven't yet" date={day.local_date} />
          <Half photo={theirs} url={theirs && urls[theirs.film_path]} label={partnerName} waiting={`waiting for ${partnerName}`} date={day.local_date} />
        </button>
      ) : (
        <div className="today__print">
          <Print date={printDate(day.local_date)}>
            <PrintPhoto>
              <div className="today__inside">
                {!arrivedAt ? (
                  <>
                    <span style={{ fontSize: 20, fontWeight: 700 }}>no ping yet</span>
                    <span className="small">
                      it'll come between {hourLabel(booth.couple.ping_window_start)} and {hourLabel(booth.couple.ping_window_end)}
                    </span>
                  </>
                ) : (
                  <>
                    <span style={{ fontSize: 20, fontWeight: 700 }}>time for today's photo</span>
                    <span className="small">you have until midnight</span>
                  </>
                )}
              </div>
            </PrintPhoto>
          </Print>
        </div>
      )}

      <div className="today__actions">
        {!anyPhoto && (
          <Segmented
            label="who's in today's photo"
            value={mode}
            onChange={chooseMode}
            options={[
              { value: "together", label: "together" },
              { value: "apart", label: "apart" },
            ]}
          />
        )}

        <PrimaryAction
          mode={mode}
          arrived={Boolean(arrivedAt)}
          hasMine={Boolean(mine)}
          hasAny={Boolean(anyPhoto)}
          onOpenCamera={() => onOpenCamera(mode)}
        />
      </div>

      {!booth.partner && (
        <div className="today__nudge">
          <span>send your person this code so they can join</span>
          <strong style={{ letterSpacing: 2 }}>{booth.couple.invite_code}</strong>
        </div>
      )}
      {booth.partner && pushState !== "on" && (
        <button className="today__nudge" type="button" onClick={onOpenSettings} style={{ border: 0, textAlign: "left", width: "100%" }}>
          <span>
            {pushState === "needs-install"
              ? "add daily booth to your home screen to get the daily ping"
              : pushState === "blocked"
              ? "pings are blocked in your phone settings"
              : "turn on the daily ping"}
          </span>
          <Icon name="forward" size={18} />
        </button>
      )}
    </div>
  );
}

function Header({ streak, onOpenSettings }: { streak: number | null; onOpenSettings: () => void }) {
  return (
    <header className="screen__header">
      <h1 className="screen__title">daily booth</h1>
      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
        {streak !== null && streak > 0 && (
          <span className="muted small">
            <strong style={{ color: "var(--ink)" }}>{streak}</strong> {streak === 1 ? "day" : "days"}
          </span>
        )}
        <button className="icon-button" type="button" aria-label="settings" onClick={onOpenSettings}>
          <Icon name="settings" />
        </button>
      </div>
    </header>
  );
}

function Half({ photo, url, label, waiting, date }: { photo: Photo | null; url?: string | false | null; label: string; waiting: string; date: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "center", minWidth: 0 }}>
      {photo && url ? (
        <PrintImage src={url} alt={`${label}'s photo`} />
      ) : (
        <Print date={printDate(date)} className="" >
          <PrintPhoto>
            <span className="today__inside small">{waiting}</span>
          </PrintPhoto>
        </Print>
      )}
      <span className="small muted">{label}</span>
    </div>
  );
}

function PrimaryAction({
  mode,
  arrived,
  hasMine,
  hasAny,
  onOpenCamera,
}: {
  mode: Mode;
  arrived: boolean;
  hasMine: boolean;
  hasAny: boolean;
  onOpenCamera: () => void;
}) {
  if (!arrived && !hasAny) {
    return <button className="button" type="button" disabled>waiting for the ping</button>;
  }
  if (mode === "together") {
    if (!hasAny) return <button className="button" type="button" onClick={onOpenCamera}>take today's photo</button>;
    if (hasMine) return <button className="button button--quiet" type="button" onClick={onOpenCamera}>retake</button>;
    return null;
  }
  if (!hasMine) return <button className="button" type="button" onClick={onOpenCamera}>take my selfie</button>;
  return <button className="button button--quiet" type="button" onClick={onOpenCamera}>retake mine</button>;
}

function latest(photos: Photo[]): Photo | null {
  return photos.length ? photos[photos.length - 1] : null;
}

