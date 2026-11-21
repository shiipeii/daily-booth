-- daily booth: row level security + photo storage
--
-- rule of thumb: you can see and change only your own couple's things.

alter table public.couples            enable row level security;
alter table public.members            enable row level security;
alter table public.days               enable row level security;
alter table public.photos             enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.app_config         enable row level security;

-- couples
create policy "read my couple" on public.couples
  for select to authenticated using (id = public.my_couple_id());
create policy "update my couple" on public.couples
  for update to authenticated using (id = public.my_couple_id());

-- members
create policy "read my couple's members" on public.members
  for select to authenticated using (couple_id = public.my_couple_id());
create policy "rename myself" on public.members
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- days (rows are created by `today()`; members can set mode and caption)
create policy "read my days" on public.days
  for select to authenticated using (couple_id = public.my_couple_id());
create policy "update my days" on public.days
  for update to authenticated using (couple_id = public.my_couple_id());

-- photos
create policy "read my couple's photos" on public.photos
  for select to authenticated using (couple_id = public.my_couple_id());
create policy "add my own photos" on public.photos
  for insert to authenticated
  with check (couple_id = public.my_couple_id() and taken_by = auth.uid());
create policy "delete my own photos" on public.photos
  for delete to authenticated using (taken_by = auth.uid());

-- push subscriptions
create policy "manage my push subscriptions" on public.push_subscriptions
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- app config is readable by anyone signed in
create policy "read app config" on public.app_config
  for select to authenticated using (true);

-- only these columns may be edited from the app
revoke update on public.days from authenticated;
grant update (mode, caption) on public.days to authenticated;
revoke update on public.couples from authenticated;
grant update (timezone, ping_window_start, ping_window_end) on public.couples to authenticated;
revoke update on public.members from authenticated;
grant update (display_name) on public.members to authenticated;

-- storage: private bucket, files live under <couple_id>/...
insert into storage.buckets (id, name, public)
values ('photos', 'photos', false)
on conflict (id) do nothing;

create policy "read my couple's files" on storage.objects
  for select to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = public.my_couple_id()::text);

create policy "upload to my couple's folder" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'photos' and (storage.foldername(name))[1] = public.my_couple_id()::text);

create policy "delete my couple's files" on storage.objects
  for delete to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = public.my_couple_id()::text);
