/* Meta Pixel (Facebook) tracking helpers — safe to call even before the pixel script loads. */

declare global {
  interface Window {
    fbq?: (...args: any[]) => void;
  }
}

function getFbq() {
  if (typeof window !== "undefined" && window.fbq) return window.fbq;
  return null;
}

/** Fire a standard Meta Pixel event. */
export function track(event: string, params?: Record<string, any>) {
  const fbq = getFbq();
  if (fbq) fbq("track", event, params || {});
}

/** Fire a custom Meta Pixel event. */
export function trackCustom(event: string, params?: Record<string, any>) {
  const fbq = getFbq();
  if (fbq) fbq("trackCustom", event, params || {});
}

/** Fire ViewContent for a given page/section. */
export function trackViewContent(params: Record<string, any> = {}) {
  track("ViewContent", params);
}

/** Fire Lead event. */
export function trackLead(params: Record<string, any> = {}) {
  track("Lead", params);
}

/** Fire StartTrial event. */
export function trackStartTrial(params: Record<string, any> = {}) {
  track("StartTrial", params);
}

/** Fire CompleteRegistration event. */
export function trackCompleteRegistration(params: Record<string, any> = {}) {
  track("CompleteRegistration", params);
}

/** Fire Contact event. */
export function trackContact(params: Record<string, any> = {}) {
  track("Contact", params);
}

/** Fire InitiateCheckout event. */
export function trackInitiateCheckout(params: Record<string, any> = {}) {
  track("InitiateCheckout", params);
}

/** Fire AddToCart event. */
export function trackAddToCart(params: Record<string, any> = {}) {
  track("AddToCart", params);
}

/** Fire Purchase event. */
export function trackPurchase(params: Record<string, any> = {}) {
  track("Purchase", params);
}

/** Fire Schedule event. */
export function trackSchedule(params: Record<string, any> = {}) {
  track("Schedule", params);
}

/** Fire Search event. */
export function trackSearch(params: Record<string, any> = {}) {
  track("Search", params);
}

/** Fire Subscribe event. */
export function trackSubscribe(params: Record<string, any> = {}) {
  track("Subscribe", params);
}

/** Fire AddPaymentInfo event. */
export function trackAddPaymentInfo(params: Record<string, any> = {}) {
  track("AddPaymentInfo", params);
}
