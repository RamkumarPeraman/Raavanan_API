-- The Express API connects as the table owner. RLS blocks access through
-- Supabase's anon/authenticated Data API roles until explicit policies exist.
DO $$
DECLARE
  table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'admin_settings', 'blogs', 'conversations', 'donations', 'events',
    'legacy_documents', 'messages', 'notifications', 'projects', 'reports',
    'roles', 'schema_migrations', 'services', 'users',
    'volunteer_opportunities', 'volunteers'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);
  END LOOP;
END
$$;

CREATE OR REPLACE FUNCTION public.raavanan_auto_enable_rls()
RETURNS event_trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  command record;
BEGIN
  FOR command IN
    SELECT * FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table', 'partitioned table')
  LOOP
    IF command.schema_name = 'public' THEN
      EXECUTE format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY', command.objid::regclass);
    END IF;
  END LOOP;
END
$$;

REVOKE ALL ON FUNCTION public.raavanan_auto_enable_rls() FROM PUBLIC;
DROP EVENT TRIGGER IF EXISTS raavanan_auto_enable_rls;
CREATE EVENT TRIGGER raavanan_auto_enable_rls
ON ddl_command_end
WHEN TAG IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
EXECUTE FUNCTION public.raavanan_auto_enable_rls();
