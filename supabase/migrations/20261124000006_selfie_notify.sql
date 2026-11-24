-- daily booth: on apart days, tell the other person when someone posts a selfie.
--
-- after a photo is added, if the day is apart and this is the person's
-- first photo that day (retakes don't notify again), call the `notify`
-- edge function. url and secret come from vault, like the ping job.

create or replace function public.notify_partner_on_photo()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  if exists (select 1 from public.days where id = new.day_id and mode = 'apart')
     and not exists (
       select 1 from public.photos
       where day_id = new.day_id and taken_by = new.taken_by and id <> new.id
     )
     and exists (select 1 from vault.decrypted_secrets where name = 'cron_secret')
  then
    perform net.http_post(
      url     := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url')
                 || '/functions/v1/notify',
      headers := jsonb_build_object(
                   'content-type', 'application/json',
                   'x-cron-secret',
                   (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')
                 ),
      body    := jsonb_build_object('photo_id', new.id)
    );
  end if;
  return new;
end;
$$;

revoke all on function public.notify_partner_on_photo() from public, anon, authenticated;

drop trigger if exists photos_notify_partner on public.photos;
create trigger photos_notify_partner
  after insert on public.photos
  for each row execute function public.notify_partner_on_photo();
