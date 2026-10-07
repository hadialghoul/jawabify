import { useEffect, useState } from 'react';
import { NATIVE_APP_SCHEME } from '@/lib/mobileBridge';

/**
 * Public Facebook Login return page for the mobile app.
 * Meta redirects here with ?code=... (or #access_token=... for older flows).
 * This page immediately deep-links back into the Jawabify app so the user
 * lands on Integrations after sign-in.
 */
export default function FacebookOAuthReturn() {
  const [message, setMessage] = useState('Returning to Jawabify…');

  useEffect(() => {
    const hash = window.location.hash.replace(/^#/, '');
    if (hash) {
      const hashParams = new URLSearchParams(hash);
      const token = hashParams.get('access_token');
      const error = hashParams.get('error_description') || hashParams.get('error');
      if ((token || error) && !window.location.search.includes('access_token') && !window.location.search.includes('error')) {
        const next = new URLSearchParams();
        if (token) next.set('access_token', token);
        if (error) next.set('error', error);
        const expires = hashParams.get('expires_in');
        if (expires) next.set('expires_in', expires);
        window.location.replace(`${window.location.pathname}?${next.toString()}`);
        return;
      }
    }

    const qs = window.location.search;
    const hasResult = qs.includes('code=') || qs.includes('access_token=') || qs.includes('error=');
    if (!hasResult) return;

    setMessage('Opening Jawabify…');
    const deepLink = `${NATIVE_APP_SCHEME}oauth/facebook/return${qs.startsWith('?') ? qs : `?${qs}`}`;
    window.location.replace(deepLink);
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}
