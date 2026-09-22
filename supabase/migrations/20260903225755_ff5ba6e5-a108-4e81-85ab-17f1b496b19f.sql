REVOKE ALL ON FUNCTION public.auto_assign_contact_on_reply() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.guard_contact_assignment() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_assignment_counts(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_assignment_counts(uuid) TO authenticated;