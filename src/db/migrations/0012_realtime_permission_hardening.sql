-- Migration: 0012_realtime_permission_hardening.sql
-- Description: Restrict execution privileges on authorize_realtime_list_access to authenticated and service_role only

-- 1. Revoke execution privileges from PUBLIC (default) and anon
REVOKE EXECUTE ON FUNCTION public.authorize_realtime_list_access(text, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.authorize_realtime_list_access(text, uuid) FROM anon;

-- 2. Explicitly grant execution privileges strictly to authenticated and service_role
GRANT EXECUTE ON FUNCTION public.authorize_realtime_list_access(text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.authorize_realtime_list_access(text, uuid) TO service_role;
