import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

const BROADCAST_CHANNEL = 'jawabify-auth';

export default function AuthCallback() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const finish = (path: string) => {
      try {
        const bc = new BroadcastChannel(BROADCAST_CHANNEL);
        bc.postMessage({ type: 'verified' });
        bc.close();
      } catch {}
      navigate(path, { replace: true });
    };

    const run = async () => {
      try {
        const url = new URL(window.location.href);
        const code = url.searchParams.get('code');
        const tokenHash = url.searchParams.get('token_hash');
        const type = (url.searchParams.get('type') || 'signup') as
          | 'signup' | 'recovery' | 'magiclink' | 'invite' | 'email_change';
        const hash = window.location.hash || '';

        // PKCE flow
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
        }
        // OTP / token_hash flow
        else if (tokenHash) {
          const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: type as any });
          if (error) throw error;
        }
        // Implicit hash flow (#access_token=...) — supabase-js auto-detects, just refresh
        else if (hash.includes('access_token')) {
          // give supabase-js a tick to parse the hash
          await new Promise((r) => setTimeout(r, 50));
        }

        // Make sure email_confirmed_at is hydrated
        await supabase.auth.refreshSession();

        if (cancelled) return;

        // Recovery → password reset page
        if (type === 'recovery') {
          finish('/reset-password');
          return;
        }
        // Verification or new sign-in → onboarding (gate will pass them through)
        finish('/onboarding');
      } catch (e: any) {
        if (cancelled) return;
        setError(e?.message || 'Verification failed. The link may have expired.');
      }
    };

    run();
    return () => { cancelled = true; };
  }, [navigate]);

  return (
    <div className="flex h-screen w-full items-center justify-center bg-background p-6">
      <div className="text-center space-y-3 max-w-md">
        {error ? (
          <>
            <h1 className="text-xl font-semibold">We couldn't verify that link</h1>
            <p className="text-sm text-muted-foreground">{error}</p>
            <button
              onClick={() => navigate('/auth', { replace: true })}
              className="text-sm text-primary hover:underline"
            >
              Back to sign in
            </button>
          </>
        ) : (
          <>
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <p className="text-sm text-muted-foreground">Verifying your email…</p>
          </>
        )}
      </div>
    </div>
  );
}
