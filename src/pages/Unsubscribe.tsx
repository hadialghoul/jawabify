import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Loader2, CheckCircle2, XCircle } from 'lucide-react';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

type State = 'validating' | 'valid' | 'invalid' | 'already' | 'submitting' | 'done' | 'error';

export default function Unsubscribe() {
  const [params] = useSearchParams();
  const token = params.get('token');
  const [state, setState] = useState<State>('validating');

  useEffect(() => {
    if (!token) { setState('invalid'); return; }
    (async () => {
      try {
        const res = await fetch(`${SUPABASE_URL}/functions/v1/handle-email-unsubscribe?token=${encodeURIComponent(token)}`, {
          headers: { apikey: SUPABASE_ANON },
        });
        const data = await res.json();
        if (data.valid) setState('valid');
        else if (data.reason === 'already_unsubscribed') setState('already');
        else setState('invalid');
      } catch { setState('error'); }
    })();
  }, [token]);

  const confirm = async () => {
    if (!token) return;
    setState('submitting');
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/handle-email-unsubscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: SUPABASE_ANON },
        body: JSON.stringify({ token }),
      });
      const data = await res.json();
      if (data.success || data.reason === 'already_unsubscribed') setState('done');
      else setState('error');
    } catch { setState('error'); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <Card className="max-w-md w-full p-8 text-center">
        {state === 'validating' && <><Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" /><p>Checking your link…</p></>}
        {state === 'valid' && (
          <>
            <h1 className="text-2xl font-semibold mb-3">Unsubscribe from Jawabify emails?</h1>
            <p className="text-muted-foreground mb-6">You'll stop receiving product emails from us. You can still sign in and use your account.</p>
            <Button onClick={confirm} className="w-full">Confirm unsubscribe</Button>
          </>
        )}
        {state === 'submitting' && <><Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" /><p>Processing…</p></>}
        {state === 'done' && (<><CheckCircle2 className="h-10 w-10 text-primary mx-auto mb-3" /><h1 className="text-2xl font-semibold mb-2">You're unsubscribed</h1><p className="text-muted-foreground">We won't send you any more emails. Sorry to see you go.</p></>)}
        {state === 'already' && (<><CheckCircle2 className="h-10 w-10 text-primary mx-auto mb-3" /><h1 className="text-2xl font-semibold mb-2">Already unsubscribed</h1><p className="text-muted-foreground">This email has already been removed from our list.</p></>)}
        {state === 'invalid' && (<><XCircle className="h-10 w-10 text-destructive mx-auto mb-3" /><h1 className="text-2xl font-semibold mb-2">Invalid link</h1><p className="text-muted-foreground">This unsubscribe link is invalid or has expired.</p></>)}
        {state === 'error' && (<><XCircle className="h-10 w-10 text-destructive mx-auto mb-3" /><h1 className="text-2xl font-semibold mb-2">Something went wrong</h1><p className="text-muted-foreground">Please try again in a moment.</p></>)}
      </Card>
    </div>
  );
}
