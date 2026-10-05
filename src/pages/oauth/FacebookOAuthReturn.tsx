import { useEffect, useState } from 'react';

/**
 * Public Facebook Login return page for the mobile app.
 * Meta redirects here with ?code=... (or #access_token=... for older flows).
 * Expo AuthSession closes when this URL loads — no Jawabify login required.
 */
export default function FacebookOAuthReturn() {
  const [message, setMessage] = useState('Returning to Jawabify…');

  useEffect(() => {
    // If Facebook returned the token in the hash (implicit flow), move it to
    // the query so Android AuthSession can read it reliably.
    const hash = window.location.hash.replace(/^#/, '');
    if (!hash) return;
    const hashParams = new URLSearchParams(hash);
    const token = hashParams.get('access_token');
    const error = hashParams.get('error_description') || hashParams.get('error');
    if (!token && !error) return;
    if (window.location.search.includes('access_token') || window.location.search.includes('error')) return;

    const next = new URLSearchParams();
    if (token) next.set('access_token', token);
    if (error) next.set('error', error);
    const expires = hashParams.get('expires_in');
    if (expires) next.set('expires_in', expires);
    setMessage('Finishing Facebook login…');
    window.location.replace(`${window.location.pathname}?${next.toString()}`);
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}
