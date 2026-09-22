import { useEffect, useState } from "react";

/**
 * Display-only local currency conversion for marketing pages.
 * Billing always happens in USD via Stripe — these are indicative prices.
 */
export type LocalCurrency = {
  code: string;
  /** Units of currency per 1 USD */
  rate: number;
  locale: string;
  /** Round displayed amounts to the nearest N units */
  round: number;
};

const USD: LocalCurrency = { code: "USD", rate: 1, locale: "en-US", round: 1 };

// Indicative rates (per 1 USD). Display only.
const CURRENCIES: Record<string, LocalCurrency> = {
  USD,
  LBP: { code: "LBP", rate: 89500, locale: "en-LB", round: 50000 },
  EUR: { code: "EUR", rate: 0.92, locale: "de-DE", round: 1 },
  GBP: { code: "GBP", rate: 0.78, locale: "en-GB", round: 1 },
  AED: { code: "AED", rate: 3.67, locale: "en-AE", round: 5 },
  SAR: { code: "SAR", rate: 3.75, locale: "en-SA", round: 5 },
  QAR: { code: "QAR", rate: 3.64, locale: "en-QA", round: 5 },
  KWD: { code: "KWD", rate: 0.31, locale: "en-KW", round: 1 },
  BHD: { code: "BHD", rate: 0.376, locale: "en-BH", round: 1 },
  OMR: { code: "OMR", rate: 0.385, locale: "en-OM", round: 1 },
  JOD: { code: "JOD", rate: 0.709, locale: "en-JO", round: 1 },
  EGP: { code: "EGP", rate: 48.5, locale: "en-EG", round: 50 },
  MAD: { code: "MAD", rate: 9.9, locale: "fr-MA", round: 10 },
  TND: { code: "TND", rate: 3.1, locale: "fr-TN", round: 5 },
  IQD: { code: "IQD", rate: 1310, locale: "en-IQ", round: 1000 },
  TRY: { code: "TRY", rate: 34, locale: "tr-TR", round: 50 },
  INR: { code: "INR", rate: 84, locale: "en-IN", round: 100 },
  PKR: { code: "PKR", rate: 278, locale: "en-PK", round: 500 },
  NGN: { code: "NGN", rate: 1550, locale: "en-NG", round: 1000 },
  ZAR: { code: "ZAR", rate: 18, locale: "en-ZA", round: 10 },
  KES: { code: "KES", rate: 129, locale: "en-KE", round: 100 },
  CAD: { code: "CAD", rate: 1.37, locale: "en-CA", round: 1 },
  AUD: { code: "AUD", rate: 1.52, locale: "en-AU", round: 1 },
  BRL: { code: "BRL", rate: 5.6, locale: "pt-BR", round: 5 },
  MXN: { code: "MXN", rate: 19.5, locale: "es-MX", round: 10 },
  IDR: { code: "IDR", rate: 15800, locale: "id-ID", round: 10000 },
  PHP: { code: "PHP", rate: 58, locale: "en-PH", round: 50 },
  MYR: { code: "MYR", rate: 4.5, locale: "ms-MY", round: 5 },
};

const COUNTRY_TO_CURRENCY: Record<string, string> = {
  LB: "LBP", US: "USD", GB: "GBP", CA: "CAD", AU: "AUD",
  AE: "AED", SA: "SAR", QA: "QAR", KW: "KWD", BH: "BHD", OM: "OMR",
  JO: "JOD", EG: "EGP", MA: "MAD", TN: "TND", IQ: "IQD", TR: "TRY",
  IN: "INR", PK: "PKR", NG: "NGN", ZA: "ZAR", KE: "KES",
  BR: "BRL", MX: "MXN", ID: "IDR", PH: "PHP", MY: "MYR",
  DE: "EUR", FR: "EUR", ES: "EUR", IT: "EUR", NL: "EUR", BE: "EUR",
  AT: "EUR", IE: "EUR", PT: "EUR", GR: "EUR", FI: "EUR", CY: "EUR",
};

// Rough IANA timezone → country hints, used as a no-network fallback.
const TZ_TO_COUNTRY: Record<string, string> = {
  "Asia/Beirut": "LB", "Asia/Dubai": "AE", "Asia/Riyadh": "SA", "Asia/Qatar": "QA",
  "Asia/Kuwait": "KW", "Asia/Bahrain": "BH", "Asia/Muscat": "OM", "Asia/Amman": "JO",
  "Africa/Cairo": "EG", "Africa/Casablanca": "MA", "Africa/Tunis": "TN",
  "Asia/Baghdad": "IQ", "Europe/Istanbul": "TR", "Asia/Kolkata": "IN", "Asia/Karachi": "PK",
  "Africa/Lagos": "NG", "Africa/Johannesburg": "ZA", "Africa/Nairobi": "KE",
  "America/Sao_Paulo": "BR", "America/Mexico_City": "MX", "Asia/Jakarta": "ID",
  "Asia/Manila": "PH", "Asia/Kuala_Lumpur": "MY", "Europe/London": "GB",
  "Europe/Berlin": "DE", "Europe/Paris": "FR", "Europe/Madrid": "ES", "Europe/Rome": "IT",
  "Europe/Amsterdam": "NL", "Europe/Brussels": "BE", "Europe/Vienna": "AT",
  "Europe/Dublin": "IE", "Europe/Lisbon": "PT", "Europe/Athens": "GR", "Europe/Helsinki": "FI",
  "Australia/Sydney": "AU", "Australia/Melbourne": "AU", "America/Toronto": "CA",
  "America/Vancouver": "CA",
};

function currencyForCountry(country?: string | null): LocalCurrency {
  if (!country) return USD;
  const code = COUNTRY_TO_CURRENCY[country.toUpperCase()];
  return (code && CURRENCIES[code]) || USD;
}

function guessFromBrowser(): LocalCurrency {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tz && TZ_TO_COUNTRY[tz]) return currencyForCountry(TZ_TO_COUNTRY[tz]);
    const loc = navigator.language || "";
    const region = loc.split("-")[1];
    if (region) return currencyForCountry(region);
  } catch {
    /* ignore */
  }
  return USD;
}

const STORAGE_KEY = "jawabify_display_currency";

export function formatLocalPrice(usd: number, c: LocalCurrency): string {
  const raw = usd * c.rate;
  const rounded = c.round > 1 ? Math.round(raw / c.round) * c.round : Math.round(raw);
  try {
    return new Intl.NumberFormat(c.locale, {
      style: "currency",
      currency: c.code,
      maximumFractionDigits: rounded >= 100 || c.round > 1 ? 0 : 2,
      minimumFractionDigits: 0,
    }).format(rounded);
  } catch {
    return `${c.code} ${rounded.toLocaleString()}`;
  }
}

/** Detects the visitor's country (IP first, browser fallback) and returns display currency helpers. */
export function useLocalCurrency() {
  const [currency, setCurrency] = useState<LocalCurrency>(() => {
    try {
      const cached = localStorage.getItem(STORAGE_KEY);
      if (cached && CURRENCIES[cached]) return CURRENCIES[cached];
    } catch {
      /* ignore */
    }
    return guessFromBrowser();
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("https://ipapi.co/json/", { signal: AbortSignal.timeout(4000) });
        if (!res.ok) return;
        const data = await res.json();
        const next = currencyForCountry(data?.country_code);
        if (cancelled) return;
        setCurrency(next);
        try {
          localStorage.setItem(STORAGE_KEY, next.code);
        } catch {
          /* ignore */
        }
      } catch {
        /* keep browser guess */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return {
    currency,
    isUsd: currency.code === "USD",
    format: (usd: number) => formatLocalPrice(usd, currency),
  };
}
