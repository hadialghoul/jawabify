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

export interface InstagramPageOption {
  pageId: string;
  pageName: string;
  igUsername: string | null;
}

/**
 * Connects Instagram DMs through Facebook Login: the user signs in with
 * Facebook, picks the Page linked to their Instagram professional account,
 * and the backend stores the Page token and subscribes it to messages.
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

  const startConnect = useCallback(async () => {
    setConnecting(true);
    // On native, Facebook Login must leave the WebView (store / cookie rules).
    // Temporarily route window.open to the Capacitor Browser plugin.
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
      toast.error("Couldn't open Facebook login", { description: 'Please disable popup/ad blockers and try again.' });
    }
  }, [finalize]);

  const cancelPageSelection = useCallback(() => {
    setPages(null);
    tokenRef.current = null;
  }, []);

  return { connecting, startConnect, pages, selectPage: finalize, cancelPageSelection };
}
