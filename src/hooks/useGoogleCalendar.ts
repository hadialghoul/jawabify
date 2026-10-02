import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface GoogleCalendarStatus {
  connected: boolean;
  email?: string | null;
  reconnectRequired?: boolean;
}

/**
 * Connect flow mirrors useInstagramConnect: open a popup synchronously in the
 * click handler, then point it at the Google consent URL. The OAuth callback
 * is a self-closing page that postMessages the result back to this window —
 * never redirect the page itself (Google blocks its consent screen in iframes).
 */
export function useGoogleCalendar() {
  const [connecting, setConnecting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<GoogleCalendarStatus>({ connected: false });
  const popupRef = useRef<Window | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('google-calendar', {
        body: { action: 'status' },
      });
      if (error) throw error;
      setStatus(data ?? { connected: false });
    } catch (err) {
      console.error('Failed to load Google Calendar status', err);
      setStatus({ connected: false });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (event.source !== popupRef.current) return;
      const data = event.data as { type?: string } | null;
      if (data?.type === 'googleCalendarConnected') {
        setConnecting(false);
        refresh();
      } else if (data?.type === 'googleCalendarFailed') {
        setConnecting(false);
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [refresh]);

  const connect = useCallback(async () => {
    setConnecting(true);
    const popup = window.open('', 'google-calendar-connect', 'width=600,height=720');
    popupRef.current = popup;
    if (!popup) {
      setConnecting(false);
      throw new Error('Popup blocked. Allow popups and try again.');
    }
    try {
      const { data, error } = await supabase.functions.invoke('google-calendar', {
        body: { action: 'connect' },
      });
      if (error) throw error;
      if (!data?.authUrl) throw new Error('No authorization URL returned');
      popup.location.href = data.authUrl;
    } catch (err) {
      popup.close();
      setConnecting(false);
      throw err;
    }
  }, []);

  const disconnect = useCallback(async () => {
    const { error } = await supabase.functions.invoke('google-calendar', {
      body: { action: 'disconnect' },
    });
    if (error) throw error;
    await refresh();
  }, [refresh]);

  return {
    connecting,
    loading,
    connected: status.connected,
    email: status.email ?? null,
    reconnectRequired: !!status.reconnectRequired,
    connect,
    disconnect,
    refresh,
  };
}
