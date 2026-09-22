/**
 * Shopify embedded-context helpers.
 *
 * Shopify App Store policy (1.2.1) forbids any off-platform payment UI inside the
 * Shopify Admin, and policy (1.1.1) forbids relying on localStorage / third-party
 * cookies. So shop identity is always read from the URL on each load, never stored.
 */

const SHOP_RE = /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/;

function normalizeShop(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const shop = raw.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  return SHOP_RE.test(shop) ? shop : null;
}

/** Shop domain carried in the current URL (`?shop=` or legacy `?shopify_install=`). */
export function readShopFromUrl(search?: string): string | null {
  try {
    const params = new URLSearchParams(search ?? window.location.search);
    return normalizeShop(params.get('shop') ?? params.get('shopify_install'));
  } catch {
    return null;
  }
}

function isFramed(): boolean {
  try {
    return window.self !== window.top;
  } catch {
    return true; // cross-origin frame access throws — we are framed
  }
}

/**
 * True when the frame chain leads back to the Shopify Admin. Used so route
 * navigation inside the Admin keeps the embedded lock even after the
 * `?shop`/`?host` params fall off the URL (we never persist them — policy 1.1.1).
 */
function hasShopifyAncestor(): boolean {
  try {
    const ancestors = (window.location as unknown as { ancestorOrigins?: DOMStringList }).ancestorOrigins;
    if (ancestors && ancestors.length) {
      for (let i = 0; i < ancestors.length; i++) {
        if (/(^|\.)shopify\.com$/.test(new URL(ancestors[i]).hostname)) return true;
      }
      return false;
    }
    // Safari/Firefox: fall back to the referrer of the embedding navigation.
    if (document.referrer) {
      return /(^|\.)shopify\.com$/.test(new URL(document.referrer).hostname);
    }
  } catch {
    /* ignore */
  }
  return false;
}

/**
 * True when the app is being viewed inside the Shopify Admin.
 * No pricing, plan cards, checkout, or any other off-platform payment path may
 * ever render in this context (Shopify policy 1.2.1).
 */
export function isEmbeddedShopify(search?: string): boolean {
  try {
    const params = new URLSearchParams(search ?? window.location.search);
    const hasShopifyParams = !!(params.get('shop') || params.get('host') || params.get('embedded'));
    if (hasShopifyParams && (isFramed() || params.get('embedded') === '1' || !!params.get('host'))) {
      return true;
    }
    // Params-free embedded navigation (App Bridge routing, incognito, etc.).
    return isFramed() && hasShopifyAncestor();
  } catch {
    return false;
  }
}


/** Append the shop param so identity survives navigation without any storage. */
export function withShop(path: string, shop: string | null): string {
  if (!shop) return path;
  return path + (path.includes('?') ? '&' : '?') + `shop=${encodeURIComponent(shop)}`;
}

/**
 * Load Shopify App Bridge (required for embedded apps: unversioned CDN script plus
 * the `shopify-api-key` meta tag). Idempotent and a no-op outside the Admin frame.
 */
export function loadAppBridge(apiKey: string): void {
  if (typeof document === 'undefined' || !apiKey) return;
  if (document.querySelector('script[data-shopify-app-bridge]')) return;

  if (!document.querySelector('meta[name="shopify-api-key"]')) {
    const meta = document.createElement('meta');
    meta.name = 'shopify-api-key';
    meta.content = apiKey;
    document.head.prepend(meta);
  }

  const script = document.createElement('script');
  script.src = 'https://cdn.shopify.com/shopifycloud/app-bridge.js';
  script.async = false;
  script.setAttribute('data-shopify-app-bridge', 'true');
  document.head.appendChild(script);
}
