-- Community v2: open Check-In feed, Pacts (goal groups), Kept (paid inner circle). Run after schema.sql + hardening.sql. Safe to re-run.

-- 1. Everyone can post to the public Check-In feed; group posts stay Kept-only.
drop policy if exists "circle members post" on public.posts;
create policy "members post" on public.posts for insert with check (
  (select auth.role()) = 'authenticated' and (
    group_id is null
    or ((select public.has_circle((select auth.uid()))) and group_id = (select p.group_id from public.profiles p where p.id = (select auth.uid())))
  )
);
-- Show a Kept badge on posts from paid members (set by the server, not the client).
alter table public.posts add column if not exists author_kept boolean not null default false;
create or replace function public.post_defaults() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.user_id := auth.uid();
  new.cheer_count := 0;
  select coalesce(nullif(first_name,''),'Member'), (circle_active or tier in ('performance','longevity'))
    into new.author_name, new.author_kept from profiles where id = auth.uid();
  return new;
end $$;
revoke execute on function public.post_defaults() from public, anon, authenticated;

-- 2. Pacts: goal groups you join for a set number of days and check in on.
create table if not exists public.pacts (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) <= 60),
  goal text not null check (char_length(goal) <= 140),
  icon text not null default 'check',
  days int not null default 30 check (days between 7 and 90),
  members_only boolean not null default false,   -- Kept-only pacts
  active boolean not null default true,
  sort int not null default 0,
  created_at timestamptz not null default now()
);
alter table public.pacts enable row level security;
drop policy if exists "pacts readable" on public.pacts;
create policy "pacts readable" on public.pacts for select using (
  (select auth.role()) = 'authenticated' and active and (not members_only or (select public.has_circle((select auth.uid()))))
);

create table if not exists public.pact_members (
  pact_id uuid references public.pacts(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade default auth.uid(),
  joined_on date not null default (now() at time zone 'America/Chicago')::date,
  primary key (pact_id, user_id)
);
alter table public.pact_members enable row level security;
create index if not exists pact_members_user_idx on public.pact_members (user_id);
drop policy if exists "my pacts" on public.pact_members;
create policy "my pacts" on public.pact_members for select using (user_id = (select auth.uid()));
drop policy if exists "join pact" on public.pact_members;
create policy "join pact" on public.pact_members for insert with check (
  user_id = (select auth.uid()) and exists (select 1 from public.pacts p where p.id = pact_id)
);
drop policy if exists "leave pact" on public.pact_members;
create policy "leave pact" on public.pact_members for delete using (user_id = (select auth.uid()));

create table if not exists public.pact_checkins (
  pact_id uuid references public.pacts(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade default auth.uid(),
  day date not null,
  primary key (pact_id, user_id, day)
);
alter table public.pact_checkins enable row level security;
create index if not exists pact_checkins_user_idx on public.pact_checkins (user_id);
drop policy if exists "my checkins" on public.pact_checkins;
create policy "my checkins" on public.pact_checkins for select using (user_id = (select auth.uid()));
drop policy if exists "check in" on public.pact_checkins;
create policy "check in" on public.pact_checkins for insert with check (
  user_id = (select auth.uid()) and exists (select 1 from public.pact_members m where m.pact_id = pact_checkins.pact_id and m.user_id = (select auth.uid()))
  and day between ((now() at time zone 'America/Chicago')::date - 1) and ((now() at time zone 'America/Chicago')::date + 1)
);
drop policy if exists "undo check in" on public.pact_checkins;
create policy "undo check in" on public.pact_checkins for delete using (user_id = (select auth.uid()));

-- Group numbers (how many joined, how many checked in today) without exposing who.
create or replace function public.pact_stats() returns table (pact_id uuid, members int, today int)
language sql stable security definer set search_path = public as $$
  select p.id,
    (select count(*)::int from pact_members m where m.pact_id = p.id),
    (select count(*)::int from pact_checkins c where c.pact_id = p.id and c.day = (now() at time zone 'America/Chicago')::date)
  from pacts p where p.active;
$$;
revoke execute on function public.pact_stats() from public, anon;
grant execute on function public.pact_stats() to authenticated;

-- Starter pacts (only inserted once).
insert into public.pacts (title, goal, icon, days, members_only, sort)
select * from (values
  ('Protein breakfast', 'Get protein in at breakfast every day.', 'protein', 30, false, 1),
  ('Walk 8k a day', 'Hit 8,000 steps, or a 30-minute walk.', 'move', 30, false, 2),
  ('Strength 3x a week', 'Do a strength session three times a week. Check in on the days you train.', 'move', 30, false, 3),
  ('Lights out by 10:30', 'Screens down and lights out by 10:30.', 'sleep', 21, false, 4),
  ('Kept: 30-day reset', 'All five daily habits, every day, with the Kept group.', 'check', 30, true, 5)
) v(title, goal, icon, days, members_only, sort)
where not exists (select 1 from public.pacts);
