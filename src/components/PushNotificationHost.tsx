import { useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { bindNotificationOpens, registerPushToken } from '../lib/pushNotifications';

export function PushNotificationHost() {
  const { user, ownTenantId } = useAuth();

  useEffect(() => bindNotificationOpens(), []);

  useEffect(() => {
    if (!user?.id || !ownTenantId) return;
    void registerPushToken(user.id, ownTenantId);
  }, [user?.id, ownTenantId]);

  return null;
}
