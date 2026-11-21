-- daily booth: run the `tick` edge function every minute.
--
-- the function url and shared secret are read from supabase vault at run
-- time (see scripts/provision.sh), so no secrets live in this repo.

create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net  with schema extensions;

select cron.schedule(
  'daily-booth-tick',
  '* * * * *',
  $job$
    select net.http_post(
      url     := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url')
                 || '/functions/v1/tick',
      headers := jsonb_build_object(
                   'content-type', 'application/json',
                   'x-cron-secret',
                   (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')
                 ),
      body    := '{}'::jsonb
    )
    where exists (select 1 from vault.decrypted_secrets where name = 'cron_secret');
  $job$
);
