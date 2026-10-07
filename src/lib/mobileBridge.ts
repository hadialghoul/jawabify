// Bridge to the Jawabify Capacitor shell. Every call is guarded so the same
// web bundle keeps working in the browser.

import { Capacitor } from "@capacitor/core";
import { App } from "@capacitor/app";
import { Browser } from "@capacitor/browser";
import { APP_ORIGIN } from "@/lib/appHost";

/** Custom URL scheme from capacitor.config.ts ios.scheme */
export const NATIVE_APP_SCHEME = "Jawabify://";

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
export async function openSubscribeInBrowser(plan?: "starter" | "growth"): Promise<void> {
  const qs = plan ? `?plan=${encodeURIComponent(plan)}` : "";
  await openSystemBrowser(`${APP_ORIGIN}/subscribe${qs}`);
}

/**
 * Opens an OAuth URL in the system browser and resolves when the app is
 * reopened via a Jawabify:// deep link (see FacebookOAuthReturn).
 */
export function openAuthSession(authUrl: string): Promise<string> {
  if (!isNativeApp()) {
    return Promise.reject(new Error("Auth session is only available in the native app."));
  }

  return new Promise((resolve, reject) => {
    let settled = false;
    const listeners: Array<{ remove: () => Promise<void> }> = [];

    const cleanup = () => {
      void Promise.all(listeners.map((l) => l.remove()));
    };

    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      cleanup();
      fn();
    };

    const timeout = setTimeout(() => {
      finish(() => reject(new Error("Sign-in timed out. Please try again.")));
    }, 5 * 60 * 1000);

    void App.addListener("appUrlOpen", (event) => {
      const url = event.url;
      if (!url.toLowerCase().startsWith(NATIVE_APP_SCHEME.toLowerCase())) return;
      void Browser.close();
      finish(() => resolve(url));
    }).then((l) => listeners.push(l));

    void Browser.addListener("browserFinished", () => {
      finish(() => reject(new Error("Sign-in was cancelled.")));
    }).then((l) => listeners.push(l));

    void Browser.open({ url: authUrl, presentationStyle: "fullscreen" }).catch((e) => {
      finish(() => reject(e instanceof Error ? e : new Error("Could not open sign-in.")));
    });
  });
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
