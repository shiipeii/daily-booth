// app shell: who's signed in, which screen is showing, and shared state.
// screens are plain components; navigation is a small state machine
// (no url routes, so github pages never 404s).

import { useCallback, useEffect, useState } from "react";
import { currentUserId, loadBooth } from "./lib/api";
import { pushState as readPushState, refreshPush, type PushState } from "./lib/push";
import { isConfigured, supabase } from "./lib/supabase";
import type { Booth, Mode } from "./lib/types";
import { useTheme } from "./hooks/useTheme";
import { useToday } from "./hooks/useToday";
import { Tabs, type Tab } from "./components/Tabs";
import { Toast } from "./components/Toast";
import { AuthScreen } from "./screens/AuthScreen";
import { PairScreen } from "./screens/PairScreen";
import { TodayScreen } from "./screens/TodayScreen";
import { CameraScreen, type Capture } from "./screens/CameraScreen";
import { ReviewScreen } from "./screens/ReviewScreen";
import { AlbumScreen } from "./screens/AlbumScreen";
import { DayScreen } from "./screens/DayScreen";
import { SettingsScreen } from "./screens/SettingsScreen";

type View =
  | { name: "tabs" }
  | { name: "camera"; mode: Mode }
  | { name: "review"; mode: Mode; capture: Capture }
  | { name: "day"; date: string }
  | { name: "settings" };

export function App() {
  const [userId, setUserId] = useState<string | null | undefined>(undefined);
  const [booth, setBooth] = useState<Booth | null | undefined>(undefined);
  const [tab, setTab] = useState<Tab>("today");
  const [view, setView] = useState<View>({ name: "tabs" });
  const [toast, setToast] = useState<string | null>(null);
  const [push, setPush] = useState<PushState>("off");
  const [theme, setTheme] = useTheme();
  const today = useToday(Boolean(booth));

  // session
  useEffect(() => {
    currentUserId().then(setUserId);
    const { data } = supabase.auth.onAuthStateChange((_event, session) => setUserId(session?.user.id ?? null));
    return () => data.subscription.unsubscribe();
  }, []);

  const reloadBooth = useCallback(async () => {
    if (!userId) return setBooth(null);
    try {
      setBooth(await loadBooth(userId));
    } catch {
      setBooth(null);
    }
  }, [userId]);

  useEffect(() => {
    setBooth(undefined);
    reloadBooth();
  }, [reloadBooth]);

  // pings
  useEffect(() => {
    if (!booth) return;
    readPushState().then(setPush).catch(() => setPush("unsupported"));
    refreshPush(booth.userId).catch(() => undefined);
  }, [booth]);

  const back = (message?: string) => {
    setView({ name: "tabs" });
    if (message) setToast(message);
    today.refresh();
  };

  // render ---------------------------------------------------------------------

  if (!isConfigured) {
    return (
      <main className="screen screen--center">
        <h1 className="screen__title">daily booth</h1>
        <p className="muted">the app isn't connected to its database yet. see readme.md, “set up”.</p>
      </main>
    );
  }
  if (userId === undefined || (userId && booth === undefined)) {
    return <main className="screen screen--center"><p className="spinner">developing…</p></main>;
  }
  if (!userId) return <AuthScreen />;
  if (!booth) return <PairScreen onPaired={reloadBooth} />;

  const day = today.data?.day;

  let screen;
  if (view.name === "camera" && day) {
    screen = (
      <CameraScreen
        day={day}
        mode={view.mode}
        onClose={() => back()}
        onCaptured={(capture) => setView({ name: "review", mode: view.mode, capture })}
      />
    );
  } else if (view.name === "review" && day && today.data) {
    const photos = today.data.photos;
    const partner = [...photos].reverse().find((p) => p.taken_by !== booth.userId);
    screen = (
      <ReviewScreen
        booth={booth}
        day={day}
        mode={view.mode}
        capture={view.capture}
        existing={photos.filter((p) => p.taken_by === booth.userId)}
        partnerPrintUrl={partner ? today.data.urls[partner.film_path] ?? null : null}
        onRetake={() => {
          URL.revokeObjectURL(view.capture.printUrl);
          setView({ name: "camera", mode: view.mode });
        }}
        onDone={(message) => {
          URL.revokeObjectURL(view.capture.printUrl);
          setTab("today");
          back(message);
        }}
      />
    );
  } else if (view.name === "day") {
    screen = <DayScreen booth={booth} date={view.date} onBack={() => back()} onChanged={(m) => back(m)} />;
  } else if (view.name === "settings") {
    screen = (
      <SettingsScreen
        booth={booth}
        pushState={push}
        theme={theme}
        onTheme={setTheme}
        onPushState={setPush}
        onBack={() => back()}
        onChanged={(m) => {
          reloadBooth();
          if (m) setToast(m);
        }}
      />
    );
  } else {
    screen = (
      <main className="screen">
        {tab === "today" ? (
          <TodayScreen
            booth={booth}
            today={today.data}
            error={today.error}
            pushState={push}
            onRefresh={today.refresh}
            onOpenCamera={(mode) => setView({ name: "camera", mode })}
            onOpenDay={(date) => setView({ name: "day", date })}
            onOpenSettings={() => setView({ name: "settings" })}
          />
        ) : (
          <AlbumScreen booth={booth} onOpenDay={(date) => setView({ name: "day", date })} />
        )}
        <Tabs current={tab} onChange={setTab} />
      </main>
    );
  }

  return (
    <>
      {screen}
      <Toast message={toast} onDone={() => setToast(null)} />
    </>
  );
}
