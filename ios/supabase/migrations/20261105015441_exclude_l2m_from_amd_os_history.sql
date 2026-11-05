-- AMD OS と同じ public schema を使う L2M 専用台帳を、AMD OS の監査対象から外す。
-- 既存の監査行は追記専用のまま保持し、画面/API 側で除外する。
BEGIN;

CREATE OR REPLACE FUNCTION public.amd_os_history_is_l2m_table(p_table text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
  SELECT p_table = ANY(ARRAY[
    'boss_baseline_occurrences', 'boss_catalog', 'boss_notification_jobs',
    'boss_report_occurrences', 'boss_reports', 'boss_schedules',
    'discord_sources', 'game_servers', 'l2m_boss_auth_attempts',
    'l2m_boss_pin_accounts', 'member_boss_notification_settings',
    'member_boss_preferences', 'member_boss_server_visibility',
    'member_notification_preferences', 'notification_deliveries',
    'push_devices', 'server_bosses', 'server_invites',
    'server_memberships', 'web_push_subscriptions'
  ]);
$$;
REVOKE ALL ON FUNCTION public.amd_os_history_is_l2m_table(text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.amd_os_refresh_data_change_history_triggers()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_table record;
  v_pk_columns text;
  v_count integer := 0;
BEGIN
  FOR v_table IN
    SELECT c.oid, c.relname
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind IN ('r', 'p')
      AND NOT c.relispartition
      AND c.relname <> 'amd_os_data_change_history'
    ORDER BY c.relname
  LOOP
    IF public.amd_os_history_is_l2m_table(v_table.relname) THEN
      -- 既存のL2M用監査triggerも停止し、将来のrefreshで再作成しない。
      IF EXISTS (
        SELECT 1 FROM pg_trigger
        WHERE tgrelid = v_table.oid
          AND tgname = 'amd_os_data_change_history_trigger'
          AND tgenabled <> 'D'
      ) THEN
        EXECUTE format('ALTER TABLE public.%I DISABLE TRIGGER amd_os_data_change_history_trigger', v_table.relname);
      END IF;
      CONTINUE;
    END IF;

    IF v_table.relname = ANY(ARRAY[
      'freee_oauth_tokens', 'member_google_oauth_tokens',
      'member_microsoft_oauth_tokens', 'microsoft_oauth_states',
      'workspace_email_otp_rate_limits', 'workspace_access_requests'
    ]) THEN
      CONTINUE;
    END IF;

    SELECT string_agg(a.attname, ',' ORDER BY k.ordinality)
      INTO v_pk_columns
      FROM pg_index i
      JOIN LATERAL unnest(i.indkey) WITH ORDINALITY AS k(attnum, ordinality) ON true
      JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = k.attnum
     WHERE i.indrelid = v_table.oid
       AND i.indisprimary;

    EXECUTE format('DROP TRIGGER IF EXISTS amd_os_data_change_history_trigger ON public.%I', v_table.relname);
    EXECUTE format(
      'CREATE TRIGGER amd_os_data_change_history_trigger AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.amd_os_record_data_change(%L)',
      v_table.relname,
      COALESCE(v_pk_columns, '')
    );
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END;
$$;

DO $$
DECLARE
  v_table record;
BEGIN
  FOR v_table IN
    SELECT c.relname
    FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND t.tgname = 'amd_os_data_change_history_trigger'
      AND NOT t.tgisinternal
      AND t.tgenabled <> 'D'
      AND public.amd_os_history_is_l2m_table(c.relname)
  LOOP
    EXECUTE format('ALTER TABLE public.%I DISABLE TRIGGER amd_os_data_change_history_trigger', v_table.relname);
  END LOOP;
END;
$$;

COMMIT;
