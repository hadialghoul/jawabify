import { Capacitor } from '@capacitor/core';

/**
 * Host split:
 *   jawabify.com      -> marketing / landing site
 *   app.jawabify.com  -> the product (login + dashboard)
 *
 * Preview and localhost hosts keep serving everything so development and
 * Lovable previews are unaffected. The Capacitor shell always behaves as the
 * product host so the native app never lands on the marketing homepage.
 */
export function isAppHost(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    if (Capacitor.isNativePlatform()) return true;
  } catch {
    /* Capacitor bridge unavailable in plain web */
  }
  const host = window.location.hostname.toLowerCase();
  return host === 'app.jawabify.com' || host.startsWith('app.');
}

/** Marketing-only routes that should not be served from the app subdomain. */
export const MARKETING_PATHS = [
  '/features',
  '/how-it-works',
  '/industries',
  '/pricing',
  '/about',
  '/faq',
  '/contact',
  '/book-consultation',
  '/form',
  '/info',
];

export function isMarketingPath(pathname: string): boolean {
  return MARKETING_PATHS.includes(pathname) || pathname.startsWith('/blog/');
}

export const MARKETING_ORIGIN = 'https://jawabify.com';
export const APP_ORIGIN = 'https://app.jawabify.com';

/** True on the marketing domain (jawabify.com / www.jawabify.com) only. */
export function isMarketingHost(): boolean {
  if (typeof window === 'undefined') return false;
  const host = window.location.hostname.toLowerCase();
  return host === 'jawabify.com' || host === 'www.jawabify.com';
}

/**
 * Product routes (login + dashboard) that belong on app.jawabify.com.
 * Email-link routes (/auth/callback, /reset-password, /unsubscribe) and legal
 * pages stay reachable on both hosts so existing links never break.
 */
const PRODUCT_PATHS = [
  '/auth',
  '/app',
  '/onboarding',
  '/settings',
  '/integrations',
  '/account',
  '/tutorials',
  '/super-admin',
  '/subscribe',
  '/checkout/return',
];

export function isProductPath(pathname: string): boolean {
  if (pathname === '/auth/callback') return false;
  return PRODUCT_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

