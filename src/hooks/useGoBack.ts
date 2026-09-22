import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * Back button behaviour that matches user expectation: return to the previous
 * screen in this tab's history. Only when there is no in-app history to return
 * to (deep link, fresh tab) do we fall back to a sensible landing route.
 */
export function useGoBack(fallback: string) {
  const navigate = useNavigate();

  return useCallback(() => {
    const idx = (window.history.state as { idx?: number } | null)?.idx;
    if (typeof idx === 'number' ? idx > 0 : window.history.length > 1) {
      navigate(-1);
      return;
    }
    navigate(fallback, { replace: true });
  }, [navigate, fallback]);
}
