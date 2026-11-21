-- daily booth: database functions
--
-- clients only ever call: create_couple, join_couple, today.
-- ensure_day / ensure_all_days are internal (used by `today` and the ping job).

-- the caller's couple, or null -----------------------------------------------

create or replace function public.my_couple_id()
returns uuid
language sql stable security definer
set search_path = public
as $$
  select couple_id from public.members where user_id = auth.uid()
$$;

-- a random moment inside the couple's ping window on a local date -----------

create or replace function public.random_ping_at(c public.couples, d date)
returns timestamptz
language sql volatile
set search_path = public
as $$
  select (
    d::timestamp
    + make_interval(hours => c.ping_window_start)
    + random() * make_interval(hours => c.ping_window_end - c.ping_window_start)
  ) at time zone c.timezone
$$;

-- make sure a couple has a row for today (in their timezone) ----------------

create or replace function public.ensure_day(p_couple uuid)
returns public.days
language plpgsql security definer
set search_path = public
as $$
declare
  c public.couples;
  d date;
  r public.days;
begin
  select * into c from public.couples where id = p_couple;
  if not found then
    raise exception 'couple not found';
  end if;

  d := (now() at time zone c.timezone)::date;

  insert into public.days (couple_id, local_date, ping_at)
  values (c.id, d, public.random_ping_at(c, d))
  on conflict (couple_id, local_date) do nothing;

  select * into r from public.days where couple_id = c.id and local_date = d;
  return r;
end;
$$;

create or replace function public.ensure_all_days()
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  cid uuid;
begin
  for cid in select id from public.couples loop
    perform public.ensure_day(cid);
  end loop;
end;
$$;

-- client: today's day row for my couple --------------------------------------

create or replace function public.today()
returns public.days
language plpgsql security definer
set search_path = public
as $$
declare
  cid uuid := public.my_couple_id();
begin
  if cid is null then
    raise exception 'not in a couple yet';
  end if;
  return public.ensure_day(cid);
end;
$$;

-- client: start a couple ------------------------------------------------------

create or replace function public.create_couple(p_display_name text)
returns public.couples
language plpgsql security definer
set search_path = public
as $$
declare
  c public.couples;
begin
  if auth.uid() is null then
    raise exception 'sign in first';
  end if;
  if exists (select 1 from public.members where user_id = auth.uid()) then
    raise exception 'you are already in a couple';
  end if;

  insert into public.couples default values returning * into c;
  insert into public.members (user_id, couple_id, display_name)
  values (auth.uid(), c.id, trim(p_display_name));
  return c;
end;
$$;

-- client: join with an invite code -------------------------------------------

create or replace function public.join_couple(p_code text, p_display_name text)
returns public.couples
language plpgsql security definer
set search_path = public
as $$
declare
  c public.couples;
begin
  if auth.uid() is null then
    raise exception 'sign in first';
  end if;
  if exists (select 1 from public.members where user_id = auth.uid()) then
    raise exception 'you are already in a couple';
  end if;

  select * into c from public.couples where invite_code = lower(trim(p_code));
  if not found then
    raise exception 'that code doesn''t match a booth';
  end if;
  if (select count(*) from public.members where couple_id = c.id) >= 2 then
    raise exception 'this booth already has two people';
  end if;

  insert into public.members (user_id, couple_id, display_name)
  values (auth.uid(), c.id, trim(p_display_name));
  return c;
end;
$$;

-- permissions -------------------------------------------------------------------

revoke all on function public.ensure_day(uuid)       from public, anon, authenticated;
revoke all on function public.ensure_all_days()      from public, anon, authenticated;
revoke all on function public.random_ping_at(public.couples, date) from public, anon, authenticated;

grant execute on function public.ensure_day(uuid)  to service_role;
grant execute on function public.ensure_all_days() to service_role;

revoke all on function public.today()                       from public, anon;
revoke all on function public.create_couple(text)           from public, anon;
revoke all on function public.join_couple(text, text)       from public, anon;
grant execute on function public.today()                    to authenticated;
grant execute on function public.create_couple(text)        to authenticated;
grant execute on function public.join_couple(text, text)    to authenticated;
grant execute on function public.my_couple_id()             to authenticated;
