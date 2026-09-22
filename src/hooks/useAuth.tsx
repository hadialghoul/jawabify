import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { claimShopifyInstall } from '@/lib/shopifyPendingInstall';
import { identifyMobileUser } from '@/lib/mobileBridge';
import { invalidateCache } from '@/lib/dataCache';
import { endMemberSession } from '@/lib/memberSession';



const APP_HISTORY_LOCK_KEY = 'jawabify_app_history_locked';
const ACTING_TENANT_KEY = 'jawabify_acting_tenant';
const SUPER_ADMIN_CACHE_KEY = 'jawabify_is_super_admin';

function readCachedSuperAdmin(): boolean {
  try {
    return window.localStorage.getItem(SUPER_ADMIN_CACHE_KEY) === 'true';
  } catch {
    return false;
  }
}

function writeCachedSuperAdmin(value: boolean) {
  try {
    if (value) window.localStorage.setItem(SUPER_ADMIN_CACHE_KEY, 'true');
    else window.localStorage.removeItem(SUPER_ADMIN_CACHE_KEY);
  } catch {
    /* ignore */
  }
}

export type MemberRole = 'owner' | 'admin' | 'employee';

interface AuthContextType {
  session: Session | null;
  user: User | null;
  /** Effective tenant id: the account being managed when acting as a client. */
  tenantId: string | null;
  /** The signed-in user's own tenant id. */
  ownTenantId: string | null;
  hasCredentials: boolean;
  isSuperAdmin: boolean;
  /** The signed-in user's role inside their own account. */
  memberRole: MemberRole | null;
  /** Their tenant_members row id — used to attribute activity. */
  memberId: string | null;
  /** True for account owners/admins (and super admins). */
  isTenantAdmin: boolean;
  loading: boolean;
  actingTenantId: string | null;
  actingTenantName: string | null;
  isActingAs: boolean;
  startActingAs: (tenantId: string, tenantName: string) => void;
  stopActingAs: () => void;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  tenantId: null,
  ownTenantId: null,
  hasCredentials: false,
  isSuperAdmin: false,
  memberRole: null,
  memberId: null,
  isTenantAdmin: false,
  loading: true,
  actingTenantId: null,
  actingTenantName: null,
  isActingAs: false,
  startActingAs: () => {},
  stopActingAs: () => {},
  signOut: async () => {},
});


function readActing(): { id: string; name: string } | null {
  try {
    const raw = window.sessionStorage.getItem(ACTING_TENANT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.id ? { id: parsed.id, name: parsed.name ?? 'Account' } : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [hasCredentials, setHasCredentials] = useState(false);
  // Seed from cache so a mid-refresh role lookup can never misroute a super
  // admin into the regular user dashboard.
  const [isSuperAdmin, setIsSuperAdmin] = useState<boolean>(() => readCachedSuperAdmin());
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<{ id: string; name: string } | null>(() => readActing());
  const [memberRole, setMemberRole] = useState<MemberRole | null>(null);
  const [memberId, setMemberId] = useState<string | null>(null);

  useEffect(() => {
    let currentUserId: string | null = null;

    const loadUserContext = async (userId: string) => {
      const [{ data: member }, { data: roleRow }] = await Promise.all([
        supabase.from('tenant_members').select('id, tenant_id, role, is_active').eq('user_id', userId).order('created_at', { ascending: true }).limit(1).maybeSingle(),
        supabase.from('user_roles').select('role').eq('user_id', userId).eq('role', 'super_admin').maybeSingle(),
      ]);

      // A deactivated employee must not keep access to the account.
      if (member && member.is_active === false && !roleRow) {
        await supabase.auth.signOut();
        setTenantId(null);
        setMemberRole(null);
        setMemberId(null);
        setHasCredentials(false);
        setLoading(false);
        return;
      }

      const tid = member?.tenant_id ?? null;
      setTenantId(tid);
      setMemberRole((member?.role as MemberRole) ?? null);
      setMemberId(member?.id ?? null);
      setIsSuperAdmin(!!roleRow);
      writeCachedSuperAdmin(!!roleRow);

      if (tid) {
        claimShopifyInstall(tid).catch(() => {});
        const { data: creds } = await supabase
          .from('tenant_credentials')
          .select('id')
          .eq('tenant_id', tid)
          .eq('provider', 'whatsapp_cloud')
          .eq('is_active', true)
          .maybeSingle();
        setHasCredentials(!!creds);

      } else {
        setHasCredentials(false);
      }
      setLoading(false);
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        const nextUserId = session?.user?.id ?? null;

        // Skip heavy reload when the same user is already loaded (tab refocus
        // fires TOKEN_REFRESHED / SIGNED_IN / INITIAL_SESSION with same uid).
        if (nextUserId && nextUserId === currentUserId) {
          return;
        }

        currentUserId = nextUserId;

        if (nextUserId) {
          identifyMobileUser(nextUserId);
          setLoading(true);
          setTimeout(() => { loadUserContext(nextUserId); }, 0);
        } else {
          setTenantId(null);
          setHasCredentials(false);
          setIsSuperAdmin(false);
          writeCachedSuperAdmin(false);
          setLoading(false);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const startActingAs = (id: string, name: string) => {
    const next = { id, name };
    window.sessionStorage.setItem(ACTING_TENANT_KEY, JSON.stringify(next));
    setActing(next);
  };

  const stopActingAs = () => {
    window.sessionStorage.removeItem(ACTING_TENANT_KEY);
    setActing(null);
  };

  const signOut = async () => {
    await endMemberSession('signout').catch(() => {});
    await supabase.auth.signOut();
    invalidateCache();
    window.sessionStorage.removeItem(APP_HISTORY_LOCK_KEY);
    window.sessionStorage.removeItem(ACTING_TENANT_KEY);
    setActing(null);
    setSession(null);
    setUser(null);
    setTenantId(null);
    setHasCredentials(false);
    setIsSuperAdmin(false);
    setMemberRole(null);
    setMemberId(null);
    writeCachedSuperAdmin(false);
  };

  const isActingAs = !!acting && isSuperAdmin;
  const effectiveTenantId = isActingAs ? acting!.id : tenantId;
  const isTenantAdmin = isSuperAdmin || memberRole === 'owner' || memberRole === 'admin';

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        tenantId: effectiveTenantId,
        ownTenantId: tenantId,
        hasCredentials,
        isSuperAdmin,
        memberRole,
        memberId,
        isTenantAdmin,
        loading,
        actingTenantId: isActingAs ? acting!.id : null,
        actingTenantName: isActingAs ? acting!.name : null,
        isActingAs,
        startActingAs,
        stopActingAs,
        signOut,
      }}
    >

      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
