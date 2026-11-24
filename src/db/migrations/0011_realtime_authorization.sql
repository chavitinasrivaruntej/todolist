-- Migration: 0011_realtime_authorization.sql
-- Description: Database-level private channel authorization and broadcast forgery prevention
-- Note: Do NOT alter table on realtime.messages as it is managed by Supabase.

-- Helper function with SECURITY DEFINER to avoid infinite recursion with todo_lists/list_members RLS
CREATE OR REPLACE FUNCTION public.authorize_realtime_list_access(p_topic text, p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_list_id uuid;
BEGIN
  IF p_topic IS NULL OR p_user_id IS NULL THEN
    RETURN false;
  END IF;

  -- Match either 'realtime:list:<uuid>' or 'list:<uuid>'
  IF p_topic !~ '^(realtime:)?list:[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' THEN
    RETURN false;
  END IF;

  v_list_id := (substring(p_topic from '^(?:realtime:)?list:([0-9a-fA-F-]{36})$'))::uuid;

  -- 1. Check if user is list owner
  IF EXISTS (SELECT 1 FROM public.todo_lists WHERE id = v_list_id AND user_id = p_user_id) THEN
    RETURN true;
  END IF;

  -- 2. Check if user is collaborator (EDITOR or VIEWER)
  IF EXISTS (SELECT 1 FROM public.list_members WHERE list_id = v_list_id AND user_id = p_user_id) THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$$;

GRANT EXECUTE ON FUNCTION public.authorize_realtime_list_access(text, uuid) TO authenticated;

-- Policies on realtime.messages
DROP POLICY IF EXISTS "Allow list members to receive realtime messages" ON realtime.messages;
DROP POLICY IF EXISTS "Allow list members to track presence only" ON realtime.messages;

-- 1. SELECT Policy: Authorizes authenticated list members (Owner or Collaborator) to receive broadcasts and sync presence
CREATE POLICY "Allow list members to receive realtime messages"
ON realtime.messages FOR SELECT TO authenticated
USING (
  public.authorize_realtime_list_access(realtime.topic(), auth.uid())
);

-- 2. INSERT Policy: Permits authenticated list members to track PRESENCE only (strictly blocks broadcast forgery)
CREATE POLICY "Allow list members to track presence only"
ON realtime.messages FOR INSERT TO authenticated
WITH CHECK (
  extension = 'presence'
  AND public.authorize_realtime_list_access(realtime.topic(), auth.uid())
);
