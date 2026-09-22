import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import { CampaignsTab } from '@/components/campaigns/CampaignsTab';
import type { Contact } from '@/types/chat';

export function SuperAdminCampaignsTab() {
  const { user } = useAuth();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      const { data: mem } = await supabase
        .from('tenant_members')
        .select('tenant_id')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();
      if (!mem?.tenant_id) {
        setError('No admin tenant yet. Open Admin inbox once to initialize it.');
        setLoading(false);
        return;
      }
      const { data, error } = await supabase
        .from('contacts')
        .select('id,name,phone_number,platform,opted_out,opted_out_at,ai_enabled')
        .eq('tenant_id', mem.tenant_id)
        .eq('platform', 'whatsapp')
        .order('updated_at', { ascending: false })
        .limit(5000);
      if (error) {
        setError(error.message);
      } else {
        setContacts(
          (data || []).map((c: any) => ({
            id: c.id,
            name: c.name || c.phone_number,
            phoneNumber: c.phone_number,
            platform: c.platform || 'whatsapp',
            aiEnabled: c.ai_enabled ?? true,
            optedOut: c.opted_out ?? false,
            optedOutAt: c.opted_out_at ? new Date(c.opted_out_at) : undefined,
          }))
        );
      }
      setLoading(false);
    })();
  }, [user]);

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="animate-spin" /></div>;
  if (error) return <Card className="p-6 text-destructive">{error}</Card>;
  return <CampaignsTab contacts={contacts} />;
}
