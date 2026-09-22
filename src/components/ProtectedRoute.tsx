import { useState, useEffect } from 'react';
import { Navigate, Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useSubscription } from '@/hooks/useSubscription';
import { Button } from '@/components/ui/button';
import { LogOut, ArrowLeft } from 'lucide-react';
import { ActingAsBanner } from '@/components/ActingAsBanner';
import { isEmbeddedShopify, readShopFromUrl, withShop } from '@/lib/shopifyEmbedded';
import { useMemberSession } from '@/hooks/useMemberSession';

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, tenantId, isSuperAdmin, isTenantAdmin, isActingAs, loading, signOut } = useAuth();
  const { isActive, loading: subLoading } = useSubscription(user?.id, tenantId);

  const [showForceLogout, setShowForceLogout] = useState(false);
  useMemberSession();

  useEffect(() => {
    if (loading) {
      const timer = setTimeout(() => setShowForceLogout(true), 5000);
      return () => clearTimeout(timer);
    }
    setShowForceLogout(false);
  }, [loading]);

  if (loading) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center gap-4 bg-background">
        <div className="text-muted-foreground">Loading...</div>
        {showForceLogout && (
          <Button variant="outline" size="sm" onClick={signOut} className="gap-2">
            <LogOut className="h-4 w-4" />
            Force Logout
          </Button>
        )}
      </div>
    );
  }

  if (!user) return <Navigate to="/auth" replace />;
  // Super admins have their own workspace tenant and can access all app routes.
  // Only bounce them to /super-admin if they have no tenant yet.
  if (isSuperAdmin && !tenantId) return <Navigate to="/super-admin" replace />;
  if (!tenantId) return <Navigate to="/onboarding" replace />;

  // Super admins bypass subscription gates (including while managing a client account).
  if (!isSuperAdmin) {
    if (subLoading) {
      return (
        <div className="flex h-screen w-full items-center justify-center bg-background">
          <div className="text-muted-foreground">Loading...</div>
        </div>
      );
    }
    // Merchants viewing the app inside the Shopify Admin must never hit an
    // off-platform paywall (Shopify policy 1.2.1) — send them to the connector
    // setup screen, which points them to jawabify.com instead.
    if (!isActive) {
      // Employees cannot pay — tell them to ask the account owner instead of
      // dropping them on a checkout page.
      if (!isTenantAdmin) {
        return (
          <div className="flex h-screen w-full flex-col items-center justify-center gap-3 bg-background p-6 text-center">
            <p className="text-sm font-medium">This workspace subscription is inactive.</p>
            <p className="max-w-sm text-sm text-muted-foreground">
              Ask the account owner to renew the subscription to continue using Jawabify.
            </p>
            <Button variant="outline" size="sm" onClick={signOut} className="gap-2">
              <LogOut className="h-4 w-4" /> Sign out
            </Button>
          </div>
        );
      }
      if (isEmbeddedShopify()) {
        return <Navigate to={withShop('/shopify/connect', readShopFromUrl())} replace />;
      }
      return <Navigate to="/subscribe" replace />;
    }
  }

  return (
    <>
      {isActingAs && <ActingAsBanner />}
      <div className={isActingAs ? 'pt-9' : undefined}>{children}</div>
      {isSuperAdmin && !isActingAs && (
        <Link
          to="/super-admin"
          className="fixed bottom-4 left-4 z-50 flex items-center gap-1.5 rounded-full bg-primary px-3 py-2 text-xs font-medium text-primary-foreground shadow-lg hover:opacity-90"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Super Admin
        </Link>
      )}
    </>
  );
}
