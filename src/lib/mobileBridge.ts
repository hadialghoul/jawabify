// Bridge to the Jawabify Capacitor shell. Every call is guarded so the same
// web bundle keeps working in the browser.

import { Capacitor } from "@capacitor/core";
import { Browser } from "@capacitor/browser";
import { APP_ORIGIN } from "@/lib/appHost";

declare global {
  interface Window {
    JawabifyApp?: {
      identify?: (userId: string) => void;
      setBadge?: (count: number) => void;
    };
  }
}

export function isNativeApp(): boolean {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

/** True when this session should behave like app.jawabify.com (never marketing). */
export function isNativeProductShell(): boolean {
  return isNativeApp();
}

/** Open a URL in the system browser (SFSafariViewController / Chrome Custom Tabs). */
export async function openSystemBrowser(url: string): Promise<void> {
  if (isNativeApp()) {
    await Browser.open({ url, presentationStyle: "fullscreen" });
    return;
  }
  window.open(url, "_blank", "noopener,noreferrer");
}

/** Wait until the system browser is closed (native only). */
export function waitForSystemBrowserClosed(): Promise<void> {
  if (!isNativeApp()) return Promise.resolve();
  return new Promise((resolve) => {
    const handle = Browser.addListener("browserFinished", () => {
      void handle.then((l) => l.remove());
      resolve();
    });
  });
}

/** Store-safe subscribe: never render Stripe card UI inside the native app. */
export async function openSubscribeInBrowser(): Promise<void> {
  await openSystemBrowser(`${APP_ORIGIN}/subscribe`);
}

export function identifyMobileUser(userId: string) {
  try {
    if (window.JawabifyApp) window.JawabifyApp.identify?.(userId);
  } catch {
    /* ignore — bridge unavailable */
  }
}

export function setMobileBadge(unreadCount: number) {
  try {
    window.JawabifyApp?.setBadge?.(unreadCount);
  } catch {
    /* ignore — bridge unavailable */
  }
}
