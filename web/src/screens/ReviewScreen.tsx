import { useState } from "react";
import { addPhoto, deletePhoto, setCaption } from "../lib/api";
import { saveToCameraRoll } from "../lib/cameraRoll";
import type { Booth, CameraRollChoice, Day, Mode, Photo } from "../lib/types";
import type { Capture } from "./CameraScreen";
import { Icon } from "../components/Icon";
import { PrintImage } from "../components/Print";
import { Segmented } from "../components/Segmented";

const ROLL_KEY = "booth.cameraRoll";

export function ReviewScreen({
  booth,
  day,
  mode,
  capture,
  existing,
  partnerPrintUrl,
  onRetake,
  onDone,
}: {
  booth: Booth;
  day: Day;
  mode: Mode;
  capture: Capture;
  /** my earlier photos today; replaced when this one is saved */
  existing: Photo[];
  partnerPrintUrl: string | null;
  onRetake: () => void;
  onDone: (message: string) => void;
}) {
  const [caption, setCaptionText] = useState(day.caption ?? "");
  const [roll, setRoll] = useState<CameraRollChoice>(() => (localStorage.getItem(ROLL_KEY) as CameraRollChoice) || "film");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function chooseRoll(value: CameraRollChoice) {
    setRoll(value);
    localStorage.setItem(ROLL_KEY, value);
  }

  function save() {
    // the share sheet has to open synchronously inside the tap, so start it first
    const stamp = day.local_date;
    const files: File[] = [];
    if (roll === "film" || roll === "both") files.push(new File([capture.print], `daily-booth-${stamp}.jpg`, { type: "image/jpeg" }));
    if (roll === "original" || roll === "both") files.push(new File([capture.original], `daily-booth-${stamp}-original.jpg`, { type: "image/jpeg" }));
    const sharing = saveToCameraRoll(files);

    setBusy(true);
    setError(null);
    (async () => {
      try {
        await addPhoto({
          day,
          userId: booth.userId,
          film: capture.film,
          dateStamp: capture.dateStamp,
          original: capture.original,
          print: capture.print,
          width: capture.width,
          height: capture.height,
        });
        await Promise.all(existing.map(deletePhoto));
        if ((day.caption ?? "") !== caption.trim()) await setCaption(day.id, caption);
        await sharing;
        onDone("added to the album");
      } catch (err) {
        setError((err as Error).message.toLowerCase());
        setBusy(false);
      }
    })();
  }

  const partnerName = booth.partner?.display_name ?? "your person";

  return (
    <main className="screen">
      <header className="screen__header" style={{ justifyContent: "flex-start" }}>
        <button className="icon-button" type="button" aria-label="retake" onClick={onRetake} disabled={busy}>
          <Icon name="back" />
        </button>
        <h1 className="screen__subtitle">{mode === "together" ? "today, together" : "today, apart"}</h1>
      </header>

      <div className="screen__body">
        {mode === "together" ? (
          <div style={{ width: "min(280px, 72vw)", margin: "16px auto 0" }}>
            <PrintImage src={capture.printUrl} alt="your photo" />
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, width: "min(320px, 84vw)", margin: "16px auto 0" }}>
            <figure style={{ margin: 0, display: "flex", flexDirection: "column", gap: 8, alignItems: "center" }}>
              <PrintImage src={capture.printUrl} alt="your selfie" />
              <figcaption className="small muted">you</figcaption>
            </figure>
            <figure style={{ margin: 0, display: "flex", flexDirection: "column", gap: 8, alignItems: "center" }}>
              {partnerPrintUrl ? (
                <PrintImage src={partnerPrintUrl} alt={`${partnerName}'s selfie`} />
              ) : (
                <div className="print" style={{ width: "100%" }}>
                  <div className="print__photo"><span className="today__inside small">not yet</span></div>
                  <p className="print__date" />
                </div>
              )}
              <figcaption className="small muted">{partnerName}</figcaption>
            </figure>
          </div>
        )}

        <label className="field" style={{ marginTop: 26 }}>
          <span className="field__label" style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" }}>caption</span>
          <input className="field__input" placeholder="add a caption" maxLength={200} value={caption} onChange={(e) => setCaptionText(e.target.value)} />
        </label>

        <div style={{ marginTop: 22, display: "flex", flexDirection: "column", gap: 10 }}>
          <span className="muted" style={{ fontSize: 15 }}>also save to camera roll</span>
          <Segmented
            label="also save to camera roll"
            value={roll}
            onChange={chooseRoll}
            options={[
              { value: "film", label: "film" },
              { value: "original", label: "original" },
              { value: "both", label: "both" },
              { value: "none", label: "no" },
            ]}
          />
        </div>

        {error && <p className="error" role="alert" style={{ marginTop: 12 }}>{error}</p>}
      </div>

      <footer className="screen__footer">
        <button className="button" type="button" onClick={save} disabled={busy}>
          {busy ? "adding…" : "add to album"}
        </button>
        <button className="button button--quiet" type="button" onClick={onRetake} disabled={busy}>
          retake
        </button>
      </footer>
    </main>
  );
}
