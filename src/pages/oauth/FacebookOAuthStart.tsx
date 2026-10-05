import { useEffect, useState } from 'react';
import { META_APP_ID } from '@/lib/facebookSdk';
import { INSTAGRAM_FB_SCOPES } from '@/hooks/useInstagramConnect';

const RETURN_URI = `${window.location.origin}/fb-oauth-return.html`;

/**
 * Optional bridge page. Prefer opening Facebook's OAuth dialog directly from
 * the mobile app. This page redirects to the same dialog if opened in a browser.
 */
export default function FacebookOAuthStart() {
  const [message, setMessage] = useState('Opening Facebook…');

  useEffect(() => {
    const params = new URLSearchParams({
      client_id: META_APP_ID,
      redirect_uri: RETURN_URI,
      scope: INSTAGRAM_FB_SCOPES,
      response_type: 'code',
      auth_type: 'rerequest',
      display: 'touch',
    });
    setMessage('Continue with Facebook…');
    window.location.replace(`https://www.facebook.com/v21.0/dialog/oauth?${params.toString()}`);
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}
