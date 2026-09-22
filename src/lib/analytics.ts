/* Google Analytics 4 (gtag.js) helpers — safe no-ops when no Measurement ID is configured. */

declare global {
  interface Window {
    dataLayer?: unknown[];
  }
}

const MEASUREMENT_ID =
  (import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_ANALYTICS_API_KEY as string | undefined) ||
  "G-4M1S4WQ4KG";

let initialized = false;

function gtag(..._args: unknown[]) {
  if (typeof window === "undefined") return;
  window.dataLayer = window.dataLayer || [];
  // Must push the raw `arguments` object — gtag.js ignores plain arrays.
  // eslint-disable-next-line prefer-rest-params
  window.dataLayer.push(arguments);
}

/** Load gtag.js once at app startup. */
export function initAnalytics() {
  if (initialized) return;
  if (typeof window === "undefined") return;
  if (!MEASUREMENT_ID) return;
  initialized = true;

  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${MEASUREMENT_ID}`;
  document.head.appendChild(script);

  gtag("js", new Date());
  gtag("config", MEASUREMENT_ID, { send_page_view: true });
}

/** Send a page_view on SPA route changes (gtag only auto-tracks the first load). */
export function trackPageView(path: string) {
  if (!MEASUREMENT_ID) return;
  gtag("event", "page_view", {
    page_path: path,
    page_location: typeof window !== "undefined" ? window.location.href : undefined,
    page_title: typeof document !== "undefined" ? document.title : undefined,
  });
}

/** Send a custom GA4 event. */
export function trackEvent(name: string, params: Record<string, unknown> = {}) {
  if (!MEASUREMENT_ID) return;
  gtag("event", name, params);
}
