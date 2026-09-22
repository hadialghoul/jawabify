-- 1. Extend tenant_members
ALTER TABLE public.tenant_members
  ADD COLUMN IF NOT EXISTS display_name text,
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS invited_by uuid,
  ADD COLUMN IF NOT EXISTS last_seen_at timestamptz,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.tenant_members ALTER COLUMN role SET DEFAULT 'employee';

CREATE UNIQUE INDEX IF NOT EXISTS tenant_members_tenant_user_key
  ON public.tenant_members (tenant_id, user_id);

-- 2. Role helpers (security definer, avoid RLS recursion)
CREATE OR REPLACE FUNCTION public.tenant_member_role(p_tenant_id uuid)
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.tenant_members
  WHERE tenant_id = p_tenant_id AND user_id = auth.uid()
  ORDER BY created_at LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.is_tenant_admin(p_tenant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_super_admin()
      OR COALESCE(public.tenant_member_role(p_tenant_id) IN ('owner','admin'), false)
$$;

-- 3. Team management policies on tenant_members
DROP POLICY IF EXISTS "Admins manage their tenant members" ON public.tenant_members;
CREATE POLICY "Admins manage their tenant members"
ON public.tenant_members FOR ALL TO authenticated
USING (public.is_tenant_admin(tenant_id))
WITH CHECK (public.is_tenant_admin(tenant_id));

DROP POLICY IF EXISTS "Members update their own presence" ON public.tenant_members;
CREATE POLICY "Members update their own presence"
ON public.tenant_members FOR UPDATE TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- 4. Sessions table
CREATE TABLE IF NOT EXISTS public.tenant_member_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  member_id uuid REFERENCES public.tenant_members(id) ON DELETE SET NULL,
  user_id uuid NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  end_reason text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tenant_member_sessions TO authenticated;
GRANT ALL ON public.tenant_member_sessions TO service_role;

ALTER TABLE public.tenant_member_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view tenant sessions"
ON public.tenant_member_sessions FOR SELECT TO authenticated
USING (public.is_tenant_admin(tenant_id) OR user_id = auth.uid());

CREATE POLICY "Members insert their own sessions"
ON public.tenant_member_sessions FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid() AND tenant_id = public.get_user_tenant_id(auth.uid()));

CREATE POLICY "Members update their own sessions"
ON public.tenant_member_sessions FOR UPDATE TO authenticated
USING (user_id = auth.uid() OR public.is_tenant_admin(tenant_id))
WITH CHECK (user_id = auth.uid() OR public.is_tenant_admin(tenant_id));

CREATE POLICY "Admins delete tenant sessions"
ON public.tenant_member_sessions FOR DELETE TO authenticated
USING (public.is_tenant_admin(tenant_id));

CREATE INDEX IF NOT EXISTS tenant_member_sessions_tenant_started_idx
  ON public.tenant_member_sessions (tenant_id, started_at DESC);
CREATE INDEX IF NOT EXISTS tenant_member_sessions_open_idx
  ON public.tenant_member_sessions (user_id, ended_at);

CREATE TRIGGER update_tenant_member_sessions_updated_at
BEFORE UPDATE ON public.tenant_member_sessions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5. Attribution columns
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS sent_by_member_id uuid;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS created_by_member_id uuid;
CREATE INDEX IF NOT EXISTS messages_sent_by_member_idx ON public.messages (sent_by_member_id, created_at);
CREATE INDEX IF NOT EXISTS orders_created_by_member_idx ON public.orders (created_by_member_id, created_at);

-- 6. Activity report
CREATE OR REPLACE FUNCTION public.get_member_activity(
  p_tenant_id uuid,
  p_from timestamptz,
  p_to timestamptz
)
RETURNS TABLE(
  session_id uuid,
  member_id uuid,
  user_id uuid,
  display_name text,
  email text,
  role text,
  started_at timestamptz,
  last_seen_at timestamptz,
  ended_at timestamptz,
  end_reason text,
  messages_sent integer,
  orders_handled integer
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_tenant_id IS NULL OR NOT public.is_tenant_admin(p_tenant_id) THEN
    RAISE EXCEPTION 'Not authorized for tenant %', p_tenant_id;
  END IF;

  RETURN QUERY
  SELECT s.id,
         s.member_id,
         s.user_id,
         m.display_name,
         m.email,
         m.role,
         s.started_at,
         s.last_seen_at,
         s.ended_at,
         s.end_reason,
         (SELECT count(*)::int FROM public.messages msg
           WHERE msg.sent_by_member_id = s.member_id
             AND msg.created_at >= s.started_at
             AND msg.created_at <= COALESCE(s.ended_at, s.last_seen_at)),
         (SELECT count(*)::int FROM public.orders o
           WHERE o.created_by_member_id = s.member_id
             AND o.created_at >= s.started_at
             AND o.created_at <= COALESCE(s.ended_at, s.last_seen_at))
  FROM public.tenant_member_sessions s
  LEFT JOIN public.tenant_members m ON m.id = s.member_id
  WHERE s.tenant_id = p_tenant_id
    AND s.started_at >= p_from
    AND s.started_at <= p_to
  ORDER BY s.started_at DESC;
END;
$$;

-- 7. Auto-close stale sessions helper
CREATE OR REPLACE FUNCTION public.close_stale_member_sessions(p_max_minutes integer DEFAULT 5)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_count integer;
BEGIN
  WITH upd AS (
    UPDATE public.tenant_member_sessions
       SET ended_at = last_seen_at, end_reason = 'timeout'
     WHERE ended_at IS NULL
       AND last_seen_at < now() - make_interval(mins => p_max_minutes)
     RETURNING 1
  )
  SELECT count(*) INTO v_count FROM upd;
  RETURN v_count;
END;
$$;