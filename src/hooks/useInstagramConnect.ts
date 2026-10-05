import { useCallback, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { actingHeaders } from '@/lib/actingTenant';
import { loadFacebookSdk } from '@/lib/facebookSdk';
import { isNativeApp, openSystemBrowser } from '@/lib/mobileBridge';

/** Permissions requested through Facebook Login for Instagram messaging. */
export const INSTAGRAM_FB_SCOPES = [
  'instagram_basic',
  'instagram_manage_messages',
  'pages_show_list',
].join(',');

/** Canonical OAuth return path (must match Meta app Valid OAuth Redirect URIs). */
export const INSTAGRAM_OAUTH_REDIRECT_PATH = '/integrations';

export interface InstagramPageOption {
  pageId: string;
  pageName: string;
  igUsername: string | null;
}

function oauthRedirectUrl() {
  return `${window.location.origin}${INSTAGRAM_OAUTH_REDIRECT_PATH}`;
}

function persistOAuthState(state: string) {
  window.sessionStorage.setItem('instagram_oauth_state', state);
  window.localStorage.setItem('instagram_oauth_state', state);
}

/**
 * Connects Instagram DMs:
 * 1. Primary — Instagram Business Login (redirect to Instagram, return with ?code=)
 * 2. Fallback — Facebook Login + Page linked to the IG professional account
 */
export function useInstagramConnect(onConnected?: () => void) {
  const [connecting, setConnecting] = useState(false);
  const [pages, setPages] = useState<InstagramPageOption[] | null>(null);
  const tokenRef = useRef<string | null>(null);

  const finalize = useCallback(
    async (pageId?: string) => {
      const userAccessToken = tokenRef.current;
      if (!userAccessToken) return;
      setConnecting(true);
      try {
        const { data, error } = await supabase.functions.invoke('instagram-connect', {
          headers: actingHeaders(),
          body: { userAccessToken, pageId },
        });
        if (error) throw error;
        if (data?.needsPageSelection && Array.isArray(data.pages)) {
          setPages(data.pages);
          return;
        }
        if (!data?.success) throw new Error(data?.error || 'Instagram connection failed');
        setPages(null);
        tokenRef.current = null;
        toast.success(`Instagram connected${data.username ? ` (@${data.username})` : ''}`);
        onConnected?.();
      } catch (err: any) {
        toast.error('Instagram connection failed', { description: err?.message });
      } finally {
        setConnecting(false);
      }
    },
    [onConnected],
  );

  /** Primary: open Instagram's own OAuth login, then return to /integrations?code=... */
  const startInstagramLogin = useCallback(async () => {
    setConnecting(true);
    try {
      const redirectTo = oauthRedirectUrl();
      const { data, error } = await supabase.functions.invoke('instagram-connect', {
        headers: actingHeaders(),
        body: { action: 'start', redirectTo },
      });
      if (error) throw error;
      if (!data?.authUrl || !data?.state) {
        throw new Error(data?.error || 'No authorization URL returned');
      }
      persistOAuthState(data.state);
      if (isNativeApp()) {
        await openSystemBrowser(data.authUrl);
        setConnecting(false);
        return;
      }
      window.location.href = data.authUrl;
    } catch (err: any) {
      console.error(err);
      setConnecting(false);
      toast.error("Couldn't start the Instagram connection", {
        description: err?.message || 'Please try again in a moment.',
      });
    }
  }, []);

  /** Fallback: Facebook Login SDK → Page picker → store Page token. */
  const startConnect = useCallback(async () => {
    setConnecting(true);
    let restoreOpen: (() => void) | undefined;
    try {
      if (isNativeApp()) {
        const originalOpen = window.open.bind(window);
        window.open = ((url?: string | URL, ..._args: any[]) => {
          if (url) void openSystemBrowser(String(url));
          return null;
        }) as typeof window.open;
        restoreOpen = () => {
          window.open = originalOpen;
        };
      }

      const FB = await loadFacebookSdk();
      FB.login(
        (response: any) => {
          restoreOpen?.();
          const token = response?.authResponse?.accessToken;
          if (!token) {
            setConnecting(false);
            toast.error('Facebook login was cancelled.');
            return;
          }
          tokenRef.current = token;
          finalize();
        },
        { scope: INSTAGRAM_FB_SCOPES, return_scopes: true, auth_type: 'rerequest' },
      );
    } catch (err) {
      restoreOpen?.();
      console.error(err);
      setConnecting(false);
      toast.error("Couldn't open Facebook login", {
        description: 'Please disable popup/ad blockers and try again.',
      });
    }
  }, [finalize]);

  const cancelPageSelection = useCallback(() => {
    setPages(null);
    tokenRef.current = null;
  }, []);

  return {
    connecting,
    startInstagramLogin,
    startConnect,
    pages,
    selectPage: finalize,
    cancelPageSelection,
  };
}
