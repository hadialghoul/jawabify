import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { invalidateCache } from '../lib/dataCache';
import {
  getActingMemory,
  loadActing,
  persistActing,
  readCachedSuperAdmin,
  writeCachedSuperAdmin,
} from '../lib/actingTenant';

export type MemberRole = 'owner' | 'admin' | 'employee';

interface AuthContextType {
  session: Session | null;
  user: User | null;
  tenantId: string | null;
  ownTenantId: string | null;
  hasCredentials: boolean;
  isSuperAdmin: boolean;
  memberRole: MemberRole | null;
  memberId: string | null;
  isTenantAdmin: boolean;
  loading: boolean;
  actingTenantId: string | null;
  actingTenantName: string | null;
  isActingAs: boolean;
  startActingAs: (tenantId: string, tenantName: string) => void;
  stopActingAs: () => void;
  signOut: () => Promise<void>;
  refreshContext: () => Promise<void>;
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
  refreshContext: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [hasCredentials, setHasCredentials] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<{ id: string; name: string } | null>(getActingMemory());
  const [memberRole, setMemberRole] = useState<MemberRole | null>(null);
  const [memberId, setMemberId] = useState<string | null>(null);

  useEffect(() => {
    let currentUserId: string | null = null;
    let cancelled = false;

    const loadUserContext = async (userId: string) => {
      const [{ data: member }, { data: roleRow }] = await Promise.all([
        supabase
          .from('tenant_members')
          .select('id, tenant_id, role, is_active')
          .eq('user_id', userId)
          .order('created_at', { ascending: true })
          .limit(1)
          .maybeSingle(),
        supabase.from('user_roles').select('role').eq('user_id', userId).eq('role', 'super_admin').maybeSingle(),
      ]);

      if (cancelled) return;

      if (member && member.is_active === false && !roleRow) {
        await supabase.auth.signOut();
        setTenantId(null);
        setMemberRole(null);
        setMemberId(null);
        setHasCredentials(false);
        setLoading(false);
        return;
      }

      const tid = (member as any)?.tenant_id ?? null;
      setTenantId(tid);
      setMemberRole(((member as any)?.role as MemberRole) ?? null);
      setMemberId((member as any)?.id ?? null);
      setIsSuperAdmin(!!roleRow);
      writeCachedSuperAdmin(!!roleRow);

      if (tid) {
        const { data: creds } = await supabase
          .from('tenant_credentials')
          .select('id')
          .eq('tenant_id', tid)
          .eq('provider', 'whatsapp_cloud')
          .eq('is_active', true)
          .maybeSingle();
        if (!cancelled) setHasCredentials(!!creds);
      } else {
        setHasCredentials(false);
      }
      setLoading(false);
    };

    (async () => {
      const cached = await readCachedSuperAdmin();
      const storedActing = await loadActing();
      if (!cancelled) {
        setIsSuperAdmin(cached);
        setActing(storedActing);
      }
    })();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      const nextUserId = nextSession?.user?.id ?? null;
      if (nextUserId && nextUserId === currentUserId) return;
      currentUserId = nextUserId;
      if (nextUserId) {
        setLoading(true);
        setTimeout(() => {
          loadUserContext(nextUserId);
        }, 0);
      } else {
        setTenantId(null);
        setHasCredentials(false);
        setIsSuperAdmin(false);
        writeCachedSuperAdmin(false);
        setMemberRole(null);
        setMemberId(null);
        setLoading(false);
      }
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  const startActingAs = (id: string, name: string) => {
    const next = { id, name };
    persistActing(next);
    setActing(next);
  };

  const stopActingAs = () => {
    persistActing(null);
    setActing(null);
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    invalidateCache();
    await persistActing(null);
    setActing(null);
    setSession(null);
    setUser(null);
    setTenantId(null);
    setHasCredentials(false);
    setIsSuperAdmin(false);
    setMemberRole(null);
    setMemberId(null);
    await writeCachedSuperAdmin(false);
  };

  const refreshContext = async () => {
    if (!user?.id) return;
    setLoading(true);
    const [{ data: member }, { data: roleRow }] = await Promise.all([
      supabase
        .from('tenant_members')
        .select('id, tenant_id, role, is_active')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle(),
      supabase.from('user_roles').select('role').eq('user_id', user.id).eq('role', 'super_admin').maybeSingle(),
    ]);
    const tid = (member as any)?.tenant_id ?? null;
    setTenantId(tid);
    setMemberRole(((member as any)?.role as MemberRole) ?? null);
    setMemberId((member as any)?.id ?? null);
    setIsSuperAdmin(!!roleRow);
    setLoading(false);
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
        refreshContext,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
