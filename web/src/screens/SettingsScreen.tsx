import { useState } from "react";
import { renameMe, signOut, updatePingWindow } from "../lib/api";
import { download, saveToCameraRoll } from "../lib/cameraRoll";
import { hourLabel } from "../lib/dates";
import { buildExport } from "../lib/exportZip";
import { disablePush, enablePush, isIOS, type PushState } from "../lib/push";
import type { Booth } from "../lib/types";
import type { Theme } from "../hooks/useTheme";
import { Icon } from "../components/Icon";
import { Segmented } from "../components/Segmented";

export function SettingsScreen({
  booth,
  pushState,
  theme,
  onTheme,
  onPushState,
  onBack,
  onChanged,
}: {
  booth: Booth;
  pushState: PushState;
  theme: Theme;
  onTheme: (t: Theme) => void;
  onPushState: (s: PushState) => void;
  onBack: () => void;
  onChanged: (message?: string) => void;
}) {
  const [name, setName] = useState(booth.me.display_name);
  const [start, setStart] = useState(booth.couple.ping_window_start);
  const [end, setEnd] = useState(booth.couple.ping_window_end);
  const [exporting, setExporting] = useState<string | null>(null);
  const [exportFile, setExportFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(task: () => Promise<void>) {
    setError(null);
    try {
      await task();
    } catch (err) {
      setError((err as Error).message.toLowerCase());
    }
  }

  const saveName = () => run(async () => {
    if (name.trim() && name.trim() !== booth.me.display_name) {
      await renameMe(booth.userId, name.trim());
      onChanged("name saved");
    }
  });

  const saveWindow = (s: number, e: number) => run(async () => {
    if (e <= s) return;
    setStart(s);
    setEnd(e);
    await updatePingWindow(booth.couple.id, s, e);
    onChanged("ping times saved. they apply from tomorrow.");
  });

  const togglePush = () => run(async () => {
    onPushState(pushState === "on" ? await disablePush() : await enablePush(booth.userId));
  });

  const startExport = () => run(async () => {
    setExportFile(null);
    setExporting("gathering photos…");
    try {
      const file = await buildExport(booth, (done, total) => setExporting(`packing ${done} of ${total}…`));
      setExportFile(file);
    } finally {
      setExporting(null);
    }
  });

  const hours = Array.from({ length: 25 }, (_, h) => h);

  return (
    <main className="screen">
      <header className="screen__header" style={{ justifyContent: "flex-start" }}>
        <button className="icon-button" type="button" aria-label="back" onClick={onBack}>
          <Icon name="back" />
        </button>
        <h1 className="screen__subtitle">settings</h1>
      </header>

      <div className="screen__body">
        <section className="settings__group">
          <h2 className="settings__heading">you</h2>
          <label className="field">
            <span className="field__label">your name</span>
            <input className="field__input" maxLength={40} value={name} onChange={(e) => setName(e.target.value)} onBlur={saveName} />
          </label>
          {booth.partner ? (
            <p className="muted small" style={{ margin: 0 }}>sharing a booth with {booth.partner.display_name}</p>
          ) : (
            <div>
              <p className="muted small" style={{ margin: "0 0 4px" }}>send your person this code to join</p>
              <span className="settings__code">{booth.couple.invite_code}</span>
            </div>
          )}
        </section>

        <section className="settings__group">
          <h2 className="settings__heading">daily ping</h2>
          {pushState === "needs-install" ? (
            <p className="muted small" style={{ margin: 0 }}>
              {isIOS()
                ? "on iphone, tap the share button in safari, then “add to home screen”. open daily booth from there and come back here."
                : "install daily booth from your browser menu, then come back here."}
            </p>
          ) : pushState === "unsupported" ? (
            <p className="muted small" style={{ margin: 0 }}>this browser can't receive pings. try safari on iphone or chrome on android.</p>
          ) : pushState === "blocked" ? (
            <p className="muted small" style={{ margin: 0 }}>pings are blocked. allow notifications for daily booth in your phone settings.</p>
          ) : (
            <div className="settings__row">
              <span>{pushState === "on" ? "pings are on" : "pings are off"}</span>
              <button className="button button--outline" type="button" style={{ width: "auto", height: 44, padding: "0 18px", fontSize: 15 }} onClick={togglePush}>
                {pushState === "on" ? "turn off" : "turn on"}
              </button>
            </div>
          )}
          <div className="settings__row">
            <span>between</span>
            <span style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <select className="select" aria-label="earliest ping" value={start} onChange={(e) => saveWindow(Number(e.target.value), end)}>
                {hours.slice(0, 24).map((h) => <option key={h} value={h} disabled={h >= end}>{hourLabel(h)}</option>)}
              </select>
              <span>and</span>
              <select className="select" aria-label="latest ping" value={end} onChange={(e) => saveWindow(start, Number(e.target.value))}>
                {hours.slice(1).map((h) => <option key={h} value={h} disabled={h <= start}>{hourLabel(h)}</option>)}
              </select>
            </span>
          </div>
        </section>

        <section className="settings__group">
          <h2 className="settings__heading">look</h2>
          <Segmented
            label="appearance"
            value={theme}
            onChange={onTheme}
            options={[
              { value: "system", label: "auto" },
              { value: "light", label: "light" },
              { value: "dark", label: "dark" },
            ]}
          />
        </section>

        <section className="settings__group">
          <h2 className="settings__heading">your photos</h2>
          <p className="muted small" style={{ margin: 0 }}>
            download every photo, film and original, with a list of every day. handy for a printed book or moving apps later.
          </p>
          {exportFile ? (
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <button className="link" type="button" onClick={() => saveToCameraRoll([exportFile])}>
                <Icon name="download" size={18} /> share the zip
              </button>
              <button className="link" type="button" onClick={() => download([exportFile])}>
                download the zip
              </button>
            </div>
          ) : (
            <button className="link" type="button" onClick={startExport} disabled={Boolean(exporting)}>
              <Icon name="download" size={18} /> {exporting ?? "export all photos"}
            </button>
          )}
        </section>

        {error && <p className="error" role="alert">{error}</p>}

        <section className="settings__group">
          <button className="link" type="button" onClick={signOut}>sign out</button>
        </section>
      </div>
    </main>
  );
}
