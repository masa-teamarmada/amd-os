-- Dispatch due 3-minute and 1-minute Web Push jobs from the shared database.
-- The endpoint, public API key and cron secret are provisioned separately in
-- Supabase Vault. No credential is embedded in migration history or cron.job.
create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron;

select cron.schedule(
  'l2m-boss-dispatch-web-push',
  '30 seconds',
  $job$
    select net.http_post(
      url := (select decrypted_secret from vault.decrypted_secrets where name = 'l2m_boss_function_url'),
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'apikey', (select decrypted_secret from vault.decrypted_secrets where name = 'l2m_boss_publishable_key'),
        'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'l2m_boss_cron_secret')
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 10000
    ) as request_id;
  $job$
);
