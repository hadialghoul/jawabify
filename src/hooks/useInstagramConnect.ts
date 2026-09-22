import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

/**
 * Starts the Instagram Business Login in a popup so the user can connect
 * straight from a button (same feel as the WhatsApp embedded signup).
 * The popup lands on /integrations, which completes the token exchange and
 * posts the result back here — so the registered Meta OAuth redirect URI
 * stays exactly `https://<domain>/integrations`.
 */
export function useInstagramConnect(onConnected?: () => void) {
  const [connecting, setConnecting] = useState(false);
  const popupRef = useRef<Window | null>(null);

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      const data = event.data as { type?: string; error?: string } | null;
      if (!data || data.type !== 'instagram-connect-result') return;
      setConnecting(false);
      if (data.error) {
        toast.error('Instagram connection failed', { description: data.error });
        return;
      }
      toast.success('Instagram connected');
      onConnected?.();
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [onConnected]);

  const startConnect = useCallback(async () => {
    setConnecting(true);
    // Open the popup synchronously so browsers don't block it.
    const popup = window.open('', 'jawabify-instagram', 'width=520,height=720');
    popupRef.current = popup;
    try {
      const { data, error } = await supabase.functions.invoke('instagram-connect', {
        body: { action: 'start', redirectTo: `${window.location.origin}/integrations` },
      });
      if (error) throw error;
      if (!data?.authUrl || !data?.state) throw new Error('No authorization URL returned');
      window.localStorage.setItem('instagram_oauth_state', data.state);
      if (popup) {
        popup.location.href = data.authUrl;
      } else {
        // Popup blocked — fall back to a full page redirect.
        window.location.href = data.authUrl;
      }
    } catch (err) {
      console.error(err);
      popup?.close();
      setConnecting(false);
      toast.error("Couldn't start the Instagram connection", {
        description: 'Please try again in a moment or contact support.',
      });
    }
  }, []);

  return { connecting, startConnect };
}
