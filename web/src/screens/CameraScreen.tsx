import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { FILMS, FILM_ORDER, cropFile, cropToCanvas, develop, makePrint, toJpeg } from "../lib/film";
import { printDate } from "../lib/dates";
import type { Day, Film, Mode } from "../lib/types";
import { Icon } from "../components/Icon";
import { Print } from "../components/Print";
import { Segmented } from "../components/Segmented";

/** what the camera hands to the review screen */
export interface Capture {
  original: Blob;
  print: Blob;
  printUrl: string;
  film: Film;
  dateStamp: boolean;
  width: number;
  height: number;
}

const FILM_KEY = "booth.film";
const DATE_KEY = "booth.dateStamp";

export function CameraScreen({
  day,
  mode,
  onCaptured,
  onClose,
}: {
  day: Day;
  mode: Mode;
  onCaptured: (capture: Capture) => void;
  onClose: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [facing, setFacing] = useState<"user" | "environment">("user");
  const [film, setFilm] = useState<Film>(() => (localStorage.getItem(FILM_KEY) as Film) || "warm");
  const [dateStamp, setDateStamp] = useState(() => localStorage.getItem(DATE_KEY) !== "off");
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => localStorage.setItem(FILM_KEY, film), [film]);
  useEffect(() => localStorage.setItem(DATE_KEY, dateStamp ? "on" : "off"), [dateStamp]);

  // start / restart the camera when the facing direction changes
  useEffect(() => {
    let stream: MediaStream | null = null;
    let cancelled = false;
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: facing, width: { ideal: 2560 }, height: { ideal: 2560 } },
          audio: false,
        });
        if (cancelled) return stream.getTracks().forEach((t) => t.stop());
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => undefined);
        }
        setCameraError(null);
      } catch {
        setCameraError("the camera isn't available here. you can use your phone's camera instead.");
      }
    })();
    return () => {
      cancelled = true;
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [facing]);

  async function finish(original: HTMLCanvasElement) {
    const developed = develop(original, film);
    const printed = await makePrint(developed, dateStamp ? printDate(day.local_date) : null);
    const [originalBlob, printBlob] = await Promise.all([toJpeg(original, 0.92), toJpeg(printed, 0.9)]);
    onCaptured({
      original: originalBlob,
      print: printBlob,
      printUrl: URL.createObjectURL(printBlob),
      film,
      dateStamp,
      width: original.width,
      height: original.height,
    });
  }

  async function shoot() {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    setBusy(true);
    try {
      await finish(cropToCanvas(video, video.videoWidth, video.videoHeight, facing === "user"));
    } finally {
      setBusy(false);
    }
  }

  async function fromFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    try {
      await finish(await cropFile(file));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="camera">
      <main className="screen">
        <header className="screen__header">
          <button className="icon-button" type="button" aria-label="close camera" onClick={onClose}>
            <Icon name="close" />
          </button>
          <span style={{ color: "var(--camera-muted)", fontSize: 15 }}>{mode}</span>
          <span style={{ width: 44 }} aria-hidden="true" />
        </header>

        <div className="camera__print">
          <Print date={dateStamp ? printDate(day.local_date) : ""}>
            <div className="print__photo">
              {cameraError ? (
                <p className="camera__message center">{cameraError}</p>
              ) : (
                <video
                  ref={videoRef}
                  playsInline
                  muted
                  autoPlay
                  style={{ filter: FILMS[film].preview, transform: facing === "user" ? "scaleX(-1)" : undefined }}
                />
              )}
              <div className="grain" />
              {busy && <p className="camera__message center" style={{ position: "relative", color: "#f1e8da" }}>developing…</p>}
            </div>
          </Print>
        </div>

        <div style={{ display: "flex", justifyContent: "center", marginTop: 18 }}>
          <Segmented dark label="film" value={film} onChange={setFilm} options={FILM_ORDER.map((f) => ({ value: f, label: FILMS[f].label }))} />
        </div>

        <input ref={fileRef} type="file" accept="image/*" capture="user" hidden onChange={fromFile} />

        <div className="camera__controls" style={{ marginTop: "auto", paddingTop: 24 }}>
          <button className="camera__toggle" type="button" aria-pressed={dateStamp} onClick={() => setDateStamp(!dateStamp)}>
            date
          </button>
          {cameraError ? (
            <button className="camera__shutter" type="button" aria-label="open phone camera" onClick={() => fileRef.current?.click()} disabled={busy}>
              <span />
            </button>
          ) : (
            <button className="camera__shutter" type="button" aria-label="take photo" onClick={shoot} disabled={busy}>
              <span />
            </button>
          )}
          <button
            className="icon-button"
            type="button"
            aria-label="flip camera"
            style={{ justifySelf: "end" }}
            onClick={() => setFacing(facing === "user" ? "environment" : "user")}
            disabled={Boolean(cameraError)}
          >
            <Icon name="flip" size={24} />
          </button>
        </div>
      </main>
    </div>
  );
}

