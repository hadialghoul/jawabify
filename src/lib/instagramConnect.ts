import * as WebBrowser from 'expo-web-browser';
import { APP_ORIGIN } from '../config';
import { supabase } from './supabase';
import { actingHeaders } from './actingTenant';

WebBrowser.maybeCompleteAuthSession();

/** Same Meta app id as the Jawabify website Facebook Login. */
export const META_APP_ID = '1392579008772004';

/**
 * Public return URL on the live app (SPA route — already deployed).
 * Meta → Facebook Login → Settings → Valid OAuth Redirect URIs must include this EXACT URL.
 * Meta → Settings → Basic → App Domains must include: app.jawabify.com
 */
export const FACEBOOK_OAUTH_REDIRECT = `${APP_ORIGIN}/oauth/facebook/return`;

export const INSTAGRAM_FB_SCOPES = [
  'instagram_basic',
  'instagram_manage_messages',
  'pages_show_list',
].join(',');

export interface InstagramPageOption {
  pageId: string;
  pageName: string;
  igUsername: string | null;
}

export type FacebookInstagramConnectResult =
  | { status: 'connected'; username?: string | null }
  | { status: 'needs_page'; pages: InstagramPageOption[]; userAccessToken: string };

function facebookAuthUrl(): string {
  const params = new URLSearchParams({
    client_id: META_APP_ID,
    redirect_uri: FACEBOOK_OAUTH_REDIRECT,
    scope: INSTAGRAM_FB_SCOPES,
    response_type: 'code',
    auth_type: 'rerequest',
    display: 'touch',
  });
  return `https://www.facebook.com/v21.0/dialog/oauth?${params.toString()}`;
}

function parseFacebookCallback(url: string): {
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

async function exchangeFacebookToken(
  userAccessToken: string,
  pageId?: string,
): Promise<FacebookInstagramConnectResult> {
  const { data, error } = await supabase.functions.invoke('instagram-connect', {
    headers: actingHeaders(),
    body: { userAccessToken, pageId },
  });
  if (error) throw error;
  if (data?.needsPageSelection && Array.isArray(data.pages)) {
    return {
      status: 'needs_page',
      pages: data.pages,
      userAccessToken: data.userAccessToken || userAccessToken,
    };
  }
  if (!data?.success) throw new Error(data?.error || 'Instagram connection failed');
  return { status: 'connected', username: data.username ?? null };
}

async function exchangeFacebookCode(code: string): Promise<FacebookInstagramConnectResult> {
  const { data, error } = await supabase.functions.invoke('instagram-connect', {
    headers: actingHeaders(),
    body: {
      action: 'facebook_oauth_exchange',
      code,
      redirectTo: FACEBOOK_OAUTH_REDIRECT,
    },
  });
  if (error) throw error;
  if (data?.needsPageSelection && Array.isArray(data.pages) && data?.userAccessToken) {
    return { status: 'needs_page', pages: data.pages, userAccessToken: data.userAccessToken };
  }
  if (!data?.success) {
    throw new Error(
      data?.error ||
        'Facebook connect failed. In Meta Developer → App → Facebook Login → Settings, add Valid OAuth Redirect URI exactly: https://app.jawabify.com/oauth/facebook/return — and under Settings → Basic add App Domain: app.jawabify.com',
    );
  }
  return { status: 'connected', username: data.username ?? null };
}

/**
 * Opens Facebook Login only (not Jawabify website login). Uses the app's
 * existing Supabase session to save Instagram when Facebook returns.
 */
export async function connectInstagramViaFacebook(): Promise<FacebookInstagramConnectResult> {
  const result = await WebBrowser.openAuthSessionAsync(facebookAuthUrl(), FACEBOOK_OAUTH_REDIRECT);
  if (result.type !== 'success' || !result.url) {
    throw new Error('Facebook login was cancelled.');
  }

  const { code, accessToken, error } = parseFacebookCallback(result.url);
  if (error) {
    if (/domain/i.test(error) || /redirect/i.test(error)) {
      throw new Error(
        'Meta blocked the return URL. Add https://app.jawabify.com/oauth/facebook/return under Facebook Login → Valid OAuth Redirect URIs, and app.jawabify.com under App Domains.',
      );
    }
    throw new Error(error);
  }
  if (code) return exchangeFacebookCode(code);
  if (accessToken) return exchangeFacebookToken(accessToken);

  throw new Error(
    'Facebook did not return a login code. Add https://app.jawabify.com/oauth/facebook/return in Meta → Facebook Login → Valid OAuth Redirect URIs.',
  );
}

/** Finish connect after the user picks a Facebook Page (multi-Page accounts). */
export async function finishInstagramViaFacebook(
  userAccessToken: string,
  pageId: string,
): Promise<{ username?: string | null }> {
  const outcome = await exchangeFacebookToken(userAccessToken, pageId);
  if (outcome.status !== 'connected') {
    throw new Error('Could not connect the selected Page.');
  }
  return { username: outcome.username };
}
