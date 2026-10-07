import { APP_ORIGIN } from '@/lib/appHost';
import { META_APP_ID } from '@/lib/facebookSdk';

/** Permissions requested through Facebook Login for Instagram messaging. */
export const INSTAGRAM_FB_SCOPES = [
  'instagram_basic',
  'instagram_manage_messages',
  'pages_show_list',
].join(',');

/** Public return URL registered in Meta → Facebook Login → Valid OAuth Redirect URIs. */
export const FACEBOOK_OAUTH_REDIRECT = `${APP_ORIGIN}/oauth/facebook/return`;

export function buildFacebookAuthUrl(redirectUri = FACEBOOK_OAUTH_REDIRECT): string {
  const params = new URLSearchParams({
    client_id: META_APP_ID,
    redirect_uri: redirectUri,
    scope: INSTAGRAM_FB_SCOPES,
    response_type: 'code',
    auth_type: 'rerequest',
    display: 'touch',
  });
  return `https://www.facebook.com/v21.0/dialog/oauth?${params.toString()}`;
}

export function parseFacebookCallback(url: string): {
  code?: string;
  accessToken?: string;
  error?: string;
} {
  const hash = url.includes('#') ? url.split('#')[1] : '';
  const query = url.includes('?') ? url.split('?')[1]?.split('#')[0] ?? '' : '';
  const params = new URLSearchParams(query || hash);
  const error = params.get('error_description') || params.get('error') || undefined;
  return {
    code: params.get('code') ?? undefined,
    accessToken: params.get('access_token') ?? undefined,
    error,
  };
}
