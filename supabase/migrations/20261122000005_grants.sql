-- daily booth: table permissions for the app.
--
-- newer supabase projects don't grant table access to the api roles by
-- default, so grant exactly what the app uses. row level security
-- (see *_security.sql) still decides which rows each person can touch.

grant usage on schema public to anon, authenticated, service_role;

grant select                         on public.couples            to authenticated;
grant select                         on public.members            to authenticated;
grant select                         on public.days               to authenticated;
grant select, insert, delete         on public.photos             to authenticated;
grant select, insert, update, delete on public.push_subscriptions to authenticated;
grant select                         on public.app_config         to authenticated;
grant select                         on public.day_summary        to authenticated;

-- column-level update rights were granted in *_security.sql:
--   couples (timezone, ping_window_start, ping_window_end)
--   members (display_name)
--   days    (mode, caption)

-- the ping function runs as service_role
grant all on all tables in schema public to service_role;
