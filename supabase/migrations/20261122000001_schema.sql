-- daily booth: core schema
--
-- one couple = two members. every local calendar day gets one `days` row
-- with a random ping time. photos hang off a day. day status (together,
-- apart, half, missed...) is derived in the `day_summary` view, never stored,
-- so the raw data stays simple to export and re-interpret later.

create extension if not exists pgcrypto with schema extensions;

-- couples -------------------------------------------------------------------

create table public.couples (
  id                uuid primary key default gen_random_uuid(),
  invite_code       text not null unique
                      default lower(substr(md5(gen_random_uuid()::text), 1, 6)),
  timezone          text not null default 'Asia/Singapore',
  ping_window_start smallint not null default 10 check (ping_window_start between 0 and 23),
  ping_window_end   smallint not null default 22 check (ping_window_end between 1 and 24),
  created_at        timestamptz not null default now(),
  check (ping_window_end > ping_window_start)
);

comment on table public.couples is 'one row per couple. invite_code lets the second person join.';

-- members -------------------------------------------------------------------

create table public.members (
  user_id      uuid primary key references auth.users on delete cascade,
  couple_id    uuid not null references public.couples on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 40),
  created_at   timestamptz not null default now()
);

create index members_couple_idx on public.members (couple_id);

-- days ----------------------------------------------------------------------

create table public.days (
  id           uuid primary key default gen_random_uuid(),
  couple_id    uuid not null references public.couples on delete cascade,
  local_date   date not null,
  ping_at      timestamptz not null,
  ping_sent_at timestamptz,
  mode         text check (mode in ('together', 'apart')),
  caption      text check (char_length(caption) <= 200),
  created_at   timestamptz not null default now(),
  unique (couple_id, local_date)
);

create index days_due_idx on public.days (ping_at) where ping_sent_at is null;

comment on column public.days.mode is 'null until someone picks; treated as together.';

-- photos --------------------------------------------------------------------

create table public.photos (
  id            uuid primary key default gen_random_uuid(),
  day_id        uuid not null references public.days on delete cascade,
  couple_id     uuid not null references public.couples on delete cascade,
  taken_by      uuid not null references auth.users on delete cascade,
  taken_at      timestamptz not null default now(),
  film          text not null check (film in ('warm', 'faded', 'mono')),
  date_stamp    boolean not null default true,
  original_path text not null,  -- untouched camera image in the `photos` bucket
  film_path     text not null,  -- filtered print (border + date) in the `photos` bucket
  width         int,
  height        int,
  created_at    timestamptz not null default now()
);

create index photos_day_idx on public.photos (day_id);

-- push subscriptions --------------------------------------------------------

create table public.push_subscriptions (
  endpoint   text primary key,
  user_id    uuid not null references auth.users on delete cascade,
  p256dh     text not null,
  auth       text not null,
  created_at timestamptz not null default now()
);

create index push_subscriptions_user_idx on public.push_subscriptions (user_id);

-- app config (public values only, e.g. the web push public key) -------------

create table public.app_config (
  key   text primary key,
  value text not null
);

-- day summary view ------------------------------------------------------------

create view public.day_summary
with (security_invoker = true) as
select
  d.id,
  d.couple_id,
  d.local_date,
  d.ping_at,
  d.ping_sent_at,
  coalesce(d.mode, 'together') as mode,
  d.caption,
  count(p.id)::int                as photo_count,
  count(distinct p.taken_by)::int as taker_count,
  case
    when count(p.id) = 0
         and d.local_date < (now() at time zone c.timezone)::date then 'missed'
    when count(p.id) = 0                                          then 'pending'
    when coalesce(d.mode, 'together') = 'together'                then 'together'
    when count(distinct p.taken_by) >= 2                          then 'apart'
    when d.local_date < (now() at time zone c.timezone)::date     then 'half'
    else 'waiting'
  end as status
from public.days d
join public.couples c on c.id = d.couple_id
left join public.photos p on p.day_id = d.id
group by d.id, c.timezone;

comment on view public.day_summary is
  'status: pending (no photo yet today), together, apart (both selfies), waiting (one selfie, today), half (one selfie, past day), missed.';
