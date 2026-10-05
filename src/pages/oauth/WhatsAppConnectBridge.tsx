import { useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { loadFacebookSdk } from '@/lib/facebookSdk';

const META_CONFIG_ID = '1648388239943864';
const ACTING_TENANT_KEY = 'jawabify_acting_tenant';
const DONE_PATH = '/oauth/whatsapp-done';

declare global {
  interface Window {
    FB?: any;
  }
}

/**
 * Public bridge for the Expo app: receives the Jawabify session in the URL hash
 * (no website login), runs WhatsApp Embedded Signup via Facebook, then redirects
 * to /oauth/whatsapp-done so Expo AuthSession can close and return to the app.
 */
export default function WhatsAppConnectBridge() {
  const [message, setMessage] = useState('Preparing WhatsApp connection…');
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);
  const embeddedSignupDataRef = useRef<any>(null);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (!event.origin.endsWith('facebook.com') && !event.origin.endsWith('facebook.net')) return;
      try {
        const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
        if (data?.type !== 'WA_EMBEDDED_SIGNUP') return;
        if (data.event?.startsWith('FINISH')) embeddedSignupDataRef.current = data.data || null;
        if (data.event === 'CANCEL' && data.data?.error_message) {
          setError(data.data.error_message);
        }
      } catch {
        /* ignore */
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    const finish = (params: Record<string, string>) => {
      const q = new URLSearchParams(params);
      window.location.replace(`${DONE_PATH}?${q.toString()}`);
    };

    const waitForEmbeddedSignupData = async () => {
      for (let i = 0; i < 10; i++) {
        if (embeddedSignupDataRef.current) return embeddedSignupDataRef.current;
        await new Promise((r) => setTimeout(r, 200));
      }
      return embeddedSignupDataRef.current;
    };

    (async () => {
      try {
        const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
        const accessToken = hash.get('access_token');
        const refreshToken = hash.get('refresh_token') || '';
        const tenantId = hash.get('tenant_id');
        const actingTenant = hash.get('acting_tenant');
        const actingName = hash.get('acting_name') || 'Account';

        if (accessToken) {
          const { error: sessionErr } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (sessionErr) throw sessionErr;
          window.history.replaceState({}, '', '/oauth/whatsapp-connect');
        }

        const { data: sessionData } = await supabase.auth.getSession();
        if (!sessionData.session) {
          throw new Error('Your Jawabify session was missing. Go back to the app and try again.');
        }

        if (!tenantId) {
          throw new Error('No workspace id was provided. Go back to the app and try again.');
        }

        if (actingTenant) {
          window.sessionStorage.setItem(
            ACTING_TENANT_KEY,
            JSON.stringify({ id: actingTenant, name: actingName }),
          );
        }

        setMessage('Opening Facebook to connect WhatsApp…');
        const FB = await loadFacebookSdk();
        if (!FB) throw new Error('Facebook SDK failed to load.');

        FB.login(
          (response: any) => {
            if (!response?.authResponse?.code) {
              finish({ error: 'Facebook login was cancelled.' });
              return;
            }
            void (async () => {
              try {
                setMessage('Saving WhatsApp connection…');
                const signupData = await waitForEmbeddedSignupData();
                const headers: Record<string, string> = {};
                if (actingTenant) headers['x-acting-tenant'] = actingTenant;

                const { data, error: invokeErr } = await supabase.functions.invoke('meta-exchange-token', {
                  headers,
                  body: {
                    code: response.authResponse.code,
                    tenant_id: tenantId,
                    waba_id: signupData?.waba_id || signupData?.waba_ids?.[0],
                    phone_number_id: signupData?.phone_number_id,
                    business_id: signupData?.business_id,
                  },
                });
                if (invokeErr) throw invokeErr;
                if (!data?.success) throw new Error(data?.error || 'Failed to complete WhatsApp connection');

                finish({
                  ok: '1',
                  phone: data.phone_number || data.phone_number_id || '',
                  warning: data.warning || '',
                });
              } catch (err: any) {
                finish({ error: err?.message || 'Failed to reconnect WhatsApp' });
              }
            })();
          },
          {
            config_id: META_CONFIG_ID,
            response_type: 'code',
            override_default_response_type: true,
            auth_type: 'reauthenticate',
            extras: { setup: {}, featureType: '', sessionInfoVersion: '3' },
          },
        );
      } catch (err: any) {
        setError(err?.message || 'Could not start WhatsApp connection');
        setMessage('');
      }
    })();
  }, []);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background p-6 text-center">
      {!error && <Loader2 className="h-6 w-6 animate-spin text-primary" />}
      {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
      {error ? (
        <>
          <p className="text-sm text-destructive">{error}</p>
          <button
            type="button"
            className="text-sm text-primary underline"
            onClick={() => {
              window.location.replace(`${DONE_PATH}?error=${encodeURIComponent(error)}`);
            }}
          >
            Return to the app
          </button>
        </>
      ) : null}
    </div>
  );
}
