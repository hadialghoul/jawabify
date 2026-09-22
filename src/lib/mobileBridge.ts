// Bridge to the Jawabify mobile app wrapper. The `window.JawabifyApp` object
// only exists inside the native shell, so every call is guarded.

declare global {
  interface Window {
    JawabifyApp?: {
      identify?: (userId: string) => void;
      setBadge?: (count: number) => void;
    };
  }
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
