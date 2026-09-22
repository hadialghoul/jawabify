import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Instagram, Loader2, CheckCircle2, ExternalLink } from 'lucide-react';
import { useGoBack } from '@/hooks/useGoBack';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useInstagramConnection } from '@/hooks/useChannels';
import { toast } from 'sonner';

export default function Integrations() {
  const navigate = useNavigate();
  const goBack = useGoBack('/settings');
  const { tenantId } = useAuth();
  const instagram = useInstagramConnection();
  const [connecting, setConnecting] = useState(false);


  // Complete the Meta OAuth round-trip when we come back with ?code=
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const returnedState = params.get('state');
    const oauthError = params.get('error_description') || params.get('error');
    const reportToOpener = (error?: string) => {
      if (!window.opener || window.opener === window) return false;
      window.opener.postMessage({ type: 'instagram-connect-result', error }, window.location.origin);
      window.close();
      return true;
    };
    if (oauthError) {
      window.history.replaceState({}, '', '/integrations');
      if (reportToOpener(oauthError)) return;
      toast.error('Instagram connection was not completed', { description: oauthError });
      return;
    }
    if (!code) return;
    window.history.replaceState({}, '', '/integrations');
    const expectedState =
      window.localStorage.getItem('instagram_oauth_state') ||
      window.sessionStorage.getItem('instagram_oauth_state');
    window.localStorage.removeItem('instagram_oauth_state');
    window.sessionStorage.removeItem('instagram_oauth_state');
    if (!expectedState || returnedState !== expectedState) {
      if (reportToOpener('The connection request expired. Please start again.')) return;
      toast.error('Instagram connection failed', {
        description: 'The connection request expired. Please start again.',
      });
      return;
    }
    setConnecting(true);
    supabase.functions
      .invoke('instagram-connect', {
        body: { action: 'exchange', code, redirectTo: `${window.location.origin}/integrations` },
      })
      .then(({ data, error }) => {
        if (error || data?.error) {
          const message = data?.error || 'Please make sure your Instagram professional account is set up for messaging.';
          if (reportToOpener(message)) return;
          toast.error('Instagram connection failed', {
            description: data?.error || 'Please make sure your Instagram Business account is linked to a Facebook Page.',
          });
          return;
        }
        if (reportToOpener()) return;
        toast.success('Instagram connected');
        instagram.refresh();
      })
      .finally(() => setConnecting(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const connectInstagram = async () => {
    setConnecting(true);
    try {
      const { data, error } = await supabase.functions.invoke('instagram-connect', {
        body: { action: 'start', redirectTo: `${window.location.origin}/integrations` },
      });
      if (error) throw error;
      if (data?.authUrl && data?.state) {
        window.sessionStorage.setItem('instagram_oauth_state', data.state);
        window.location.href = data.authUrl;
        return;
      }
      throw new Error('No authorization URL returned');
    } catch (err) {
      console.error(err);
      toast.error("Couldn't start the Instagram connection", {
        description: 'Please try again in a moment or contact support.',
      });
    } finally {
      setConnecting(false);
    }
  };

  const disconnectInstagram = async () => {
    if (!tenantId) return;
    const { error } = await supabase
      .from('tenant_credentials')
      .update({ is_active: false })
      .eq('tenant_id', tenantId)
      .eq('provider', 'instagram');
    if (error) {
      toast.error('Could not disconnect Instagram');
      return;
    }
    toast.success('Instagram disconnected');
    instagram.refresh();
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-20 flex items-center gap-3 border-b bg-card/95 px-4 py-3 backdrop-blur">
        <Button variant="ghost" size="icon" onClick={goBack} aria-label="Back">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-base font-semibold">Instagram Direct</h1>
          <p className="text-xs text-muted-foreground">Add Instagram DMs to your Jawabify inbox</p>
        </div>
      </header>

      <main className="mx-auto max-w-2xl space-y-4 px-4 py-5">
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#f9ce34] via-[#ee2a7b] to-[#6228d7] text-primary-foreground">
                <Instagram className="h-5 w-5" />
              </span>
              <div>
                <CardTitle className="text-base">Instagram Direct</CardTitle>
                <CardDescription>
                  {instagram.username ? `@${instagram.username}` : 'Handle Instagram DMs in the same inbox'}
                </CardDescription>
              </div>
            </div>
            {instagram.loading ? (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            ) : instagram.connected ? (
              <Badge className="gap-1">
                <CheckCircle2 className="h-3 w-3" /> Connected
              </Badge>
            ) : (
              <Badge variant="secondary">Not connected</Badge>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            <ol className="space-y-1.5 text-sm text-muted-foreground">
              <li>1. Switch your Instagram profile to a Business account.</li>
              <li>2. In Instagram, enable Settings → Messages → Connected tools.</li>
              <li>3. Connect below and approve the requested permissions.</li>
            </ol>
            {instagram.connected ? (
              <Button variant="outline" onClick={disconnectInstagram}>
                Disconnect Instagram
              </Button>
            ) : (
              <Button onClick={connectInstagram} disabled={connecting}>
                {connecting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Connect Instagram
                <ExternalLink className="ml-2 h-4 w-4" />
              </Button>
            )}
            <p className="text-xs text-muted-foreground">
              Instagram allows replies only within 24 hours of the customer's last message.
            </p>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
