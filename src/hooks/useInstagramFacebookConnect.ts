import { useCallback, useState } from 'react';
import {
  connectInstagramViaFacebook,
  finishInstagramViaFacebook,
  type InstagramPageOption,
} from '../lib/instagramConnect';
import { useToast } from './useToast';

export function useInstagramFacebookConnect(onConnected?: () => void | Promise<void>) {
  const toast = useToast();
  const [connecting, setConnecting] = useState(false);
  const [pages, setPages] = useState<InstagramPageOption[] | null>(null);
  const [pendingToken, setPendingToken] = useState<string | null>(null);

  const clearPicker = useCallback(() => {
    setPages(null);
    setPendingToken(null);
  }, []);

  const connect = useCallback(async () => {
    setConnecting(true);
    try {
      const result = await connectInstagramViaFacebook();
      if (result.status === 'needs_page') {
        setPages(result.pages);
        setPendingToken(result.userAccessToken);
        return;
      }
      await onConnected?.();
      toast.success(
        result.username ? `Instagram connected (@${result.username})` : 'Instagram connected',
      );
    } catch (e: any) {
      toast.error(e?.message || 'Could not connect Instagram');
    } finally {
      setConnecting(false);
    }
  }, [onConnected, toast]);

  const selectPage = useCallback(
    async (pageId: string) => {
      if (!pendingToken) return;
      setConnecting(true);
      try {
        const { username } = await finishInstagramViaFacebook(pendingToken, pageId);
        clearPicker();
        await onConnected?.();
        toast.success(username ? `Instagram connected (@${username})` : 'Instagram connected');
      } catch (e: any) {
        toast.error(e?.message || 'Could not connect Instagram');
      } finally {
        setConnecting(false);
      }
    },
    [clearPicker, onConnected, pendingToken, toast],
  );

  return { connecting, connect, pages, selectPage, clearPicker, pickerVisible: !!pages?.length };
}
