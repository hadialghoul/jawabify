import { useEffect, useState } from 'react';
import { NATIVE_APP_SCHEME } from '@/lib/mobileBridge';

/**
 * Public Stripe return page for the mobile app (portal + hosted checkout).
 * Stripe redirects here over HTTPS; we deep-link back into Jawabify so the
 * in-app AuthSession closes and Settings can show success + refetch.
 */
export default function BillingReturn() {
  const [message, setMessage] = useState('Returning to Jawabify…');

  useEffect(() => {
    const qs = window.location.search || '';
    setMessage('Opening Jawabify…');
    const deepLink = `${NATIVE_APP_SCHEME}billing/return${qs.startsWith('?') ? qs : qs ? `?${qs}` : ''}`;
    window.location.replace(deepLink);
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}
