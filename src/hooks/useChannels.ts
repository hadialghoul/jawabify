import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import type { ChannelFilter } from '@/types/chat';

const STORAGE_KEY = 'jawabify.channelFilter';

export interface InstagramConnection {
  connected: boolean;
  username?: string;
  igAccountId?: string;
}

/** Instagram connection status for the current tenant. */
export function useInstagramConnection() {
  const { tenantId } = useAuth();
  const [connection, setConnection] = useState<InstagramConnection>({ connected: false });
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!tenantId) {
      setConnection({ connected: false });
      setLoading(false);
      return;
    }
    const { data, error } = await supabase
      .from('tenant_credentials')
      .select('ig_account_id, ig_username, is_active')
      .eq('tenant_id', tenantId)
      .eq('provider', 'instagram')
      .maybeSingle();

    if (error) console.error('Error loading Instagram connection:', error);

    setConnection({
      connected: !!data?.ig_account_id && data.is_active !== false,
      username: (data as any)?.ig_username || undefined,
      igAccountId: (data as any)?.ig_account_id || undefined,
    });
    setLoading(false);
  }, [tenantId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { ...connection, loading, refresh };
}

/** Channel filter for the inbox, persisted locally so it survives reloads. */
export function useChannelFilter() {
  const [channel, setChannel] = useState<ChannelFilter>(() => {
    const stored = typeof window !== 'undefined' ? window.localStorage.getItem(STORAGE_KEY) : null;
    return stored === 'whatsapp' || stored === 'instagram' ? stored : 'all';
  });

  const update = useCallback((next: ChannelFilter) => {
    setChannel(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* storage unavailable */
    }
  }, []);

  return { channel, setChannel: update };
}
