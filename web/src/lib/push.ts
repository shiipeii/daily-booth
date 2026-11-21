// web push: the daily "time for today's photo" ping.
// on iphone this only works after "add to home screen" (ios 16.4+).

import { removePushSubscription, savePushSubscription, vapidPublicKey } from "./api";

export type PushState = "unsupported" | "needs-install" | "blocked" | "off" | "on";

export const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent);

export const isStandalone = () =>
  window.matchMedia("(display-mode: standalone)").matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true;

export async function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  try {
    await navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`);
  } catch (err) {
    console.warn("service worker failed to register", err);
  }
}

export async function pushState(): Promise<PushState> {
  const supported = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  if (!supported) return isIOS() && !isStandalone() ? "needs-install" : "unsupported";
  if (Notification.permission === "denied") return "blocked";
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  return sub ? "on" : "off";
}

export async function enablePush(userId: string): Promise<PushState> {
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return permission === "denied" ? "blocked" : "off";

  const key = await vapidPublicKey();
  if (!key) throw new Error("pings aren't set up on the server yet");

  const reg = await navigator.serviceWorker.ready;
  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: base64UrlToBytes(key) as BufferSource,
    }));
  await savePushSubscription(userId, sub);
  return "on";
}

export async function disablePush(): Promise<PushState> {
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  if (sub) {
    await removePushSubscription(sub.endpoint);
    await sub.unsubscribe();
  }
  return "off";
}

/** re-save the subscription on launch in case the browser rotated it */
export async function refreshPush(userId: string) {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  if (sub) await savePushSubscription(userId, sub);
}

function base64UrlToBytes(base64Url: string): Uint8Array {
  const padding = "=".repeat((4 - (base64Url.length % 4)) % 4);
  const base64 = (base64Url + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}
