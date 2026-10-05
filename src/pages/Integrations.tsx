import { useEffect, useState } from 'react';
import { ArrowLeft, Instagram, Loader2, CheckCircle2 } from 'lucide-react';
import { useGoBack } from '@/hooks/useGoBack';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useInstagramConnection } from '@/hooks/useChannels';
import { InstagramConnectButton } from '@/components/InstagramConnectButton';
import { toast } from 'sonner';

export default function Integrations() {
  const goBack = useGoBack('/settings');
  const { tenantId } = useAuth();
  const instagram = useInstagramConnection();
  const [autoStartFacebook, setAutoStartFacebook] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('connect') === 'facebook') {
      window.history.replaceState({}, '', '/integrations');
      setAutoStartFacebook(true);
    }
  }, []);

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
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
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
              <li>1. Make your Instagram a Business account and link it to your Facebook Page.</li>
              <li>2. In Instagram, turn on Settings → Messages → Connected tools → Allow access to messages.</li>
              <li>3. Connect with Facebook, select that Page, and approve the permissions.</li>
            </ol>
            {instagram.connected ? (
              <Button variant="outline" onClick={disconnectInstagram}>
                Disconnect Instagram
              </Button>
            ) : (
              <InstagramConnectButton
                onConnected={() => instagram.refresh()}
                label="Connect with Facebook"
                autoStart={autoStartFacebook}
              />
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
