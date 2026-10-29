-- Longevity Concierge database schema
-- Run once in Supabase: Dashboard -> SQL Editor -> New query -> paste this file -> Run.
-- Safe to re-run: it uses IF NOT EXISTS / OR REPLACE where possible.

-- ---------- Profiles (one per member) ----------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  first_name text check (char_length(first_name) <= 40),
  accepted_at timestamptz,                   -- accepted terms + wellness disclaimer
  tier text not null default 'free' check (tier in ('free','essentials','performance','longevity')),
  circle_active boolean not null default false,   -- paid Circle subscription (Stripe)
  stripe_customer_id text,
  group_id uuid,
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;

-- Members may read their own profile and change only their name and acceptance.
drop policy if exists "own profile read" on public.profiles;
create policy "own profile read" on public.profiles for select using (auth.uid() = id);
drop policy if exists "own profile update" on public.profiles;
create policy "own profile update" on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);
revoke update on public.profiles from authenticated, anon;
grant update (first_name, accepted_at) on public.profiles to authenticated;

-- Create a profile row automatically when someone signs up.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id) values (new.id) on conflict do nothing;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Circle access: paid subscription, or a Performance / Longevity package.
create or replace function public.has_circle(uid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select circle_active or tier in ('essentials','performance','longevity') from profiles where id = uid), false);
$$;

-- ---------- Synced app data (habits, meals, favorites, targets) ----------
create table if not exists public.user_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.user_state enable row level security;
drop policy if exists "own state" on public.user_state;
create policy "own state" on public.user_state for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------- Circle groups ----------
create table if not exists public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  next_call text default 'Thursday, 7:00 pm Central',
  call_link text,
  max_members int not null default 20,
  created_at timestamptz not null default now()
);
alter table public.groups enable row level security;
drop policy if exists "groups readable" on public.groups;
create policy "groups readable" on public.groups for select using (auth.role() = 'authenticated');
do $$ begin
  if not exists (select 1 from public.groups) then insert into public.groups (name) values ('Sunrise Circle'); end if;
end $$;
alter table public.profiles drop constraint if exists profiles_group_fk;
alter table public.profiles add constraint profiles_group_fk foreign key (group_id) references public.groups(id) on delete set null;

-- Put a member in the emptiest group when they gain Circle access; open a new group when all are full.
create or replace function public.assign_group() returns trigger
language plpgsql security definer set search_path = public as $$
declare g uuid; n int;
begin
  if new.group_id is null and (new.circle_active or new.tier in ('essentials','performance','longevity')) then
    select gr.id into g from groups gr
      left join profiles p on p.group_id = gr.id
      group by gr.id, gr.max_members
      having count(p.id) < gr.max_members
      order by count(p.id) asc limit 1;
    if g is null then
      select count(*) + 1 into n from groups;
      insert into groups (name) values ('Circle ' || n) returning id into g;
    end if;
    new.group_id := g;
  end if;
  return new;
end $$;
drop trigger if exists profiles_assign_group on public.profiles;
create trigger profiles_assign_group before insert or update on public.profiles
  for each row execute function public.assign_group();

-- ---------- Community posts and cheers ----------
create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  group_id uuid references public.groups(id) on delete cascade,   -- null = public Wins feed
  author_name text,
  body text not null check (char_length(body) between 1 and 600),
  win text check (char_length(win) <= 40),
  cheer_count int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists posts_feed_idx on public.posts (group_id, created_at desc);
alter table public.posts enable row level security;

create or replace function public.post_defaults() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.user_id := auth.uid();
  new.cheer_count := 0;
  select coalesce(nullif(first_name,''),'Member') into new.author_name from profiles where id = auth.uid();
  return new;
end $$;
drop trigger if exists posts_defaults on public.posts;
create trigger posts_defaults before insert on public.posts for each row execute function public.post_defaults();

drop policy if exists "read posts" on public.posts;
create policy "read posts" on public.posts for select using (
  auth.role() = 'authenticated' and (
    group_id is null
    or (public.has_circle(auth.uid()) and group_id = (select group_id from public.profiles where id = auth.uid()))
  )
);
drop policy if exists "circle members post" on public.posts;
create policy "circle members post" on public.posts for insert with check (
  public.has_circle(auth.uid()) and (
    group_id is null or group_id = (select group_id from public.profiles where id = auth.uid())
  )
);
drop policy if exists "delete own posts" on public.posts;
create policy "delete own posts" on public.posts for delete using (
  user_id = auth.uid() or exists (select 1 from public.profiles where id = auth.uid() and is_admin)
);

create table if not exists public.cheers (
  post_id uuid references public.posts(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade default auth.uid(),
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);
alter table public.cheers enable row level security;
drop policy if exists "read own cheers" on public.cheers;
create policy "read own cheers" on public.cheers for select using (user_id = auth.uid());
drop policy if exists "cheer visible posts" on public.cheers;
create policy "cheer visible posts" on public.cheers for insert with check (
  user_id = auth.uid() and exists (select 1 from public.posts where id = post_id)
);
drop policy if exists "uncheer" on public.cheers;
create policy "uncheer" on public.cheers for delete using (user_id = auth.uid());

create or replace function public.cheer_count() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then update posts set cheer_count = cheer_count + 1 where id = new.post_id; return new;
  else update posts set cheer_count = greatest(cheer_count - 1, 0) where id = old.post_id; return old; end if;
end $$;
drop trigger if exists cheers_count on public.cheers;
create trigger cheers_count after insert or delete on public.cheers for each row execute function public.cheer_count();

-- ---------- AI usage caps and flagged coach replies (server only) ----------
create table if not exists public.usage (
  user_id uuid references auth.users(id) on delete cascade,
  day date not null,
  coach int not null default 0,
  est int not null default 0,
  recent timestamptz[] not null default '{}',
  primary key (user_id, day)
);
alter table public.usage enable row level security;   -- no policies: only the server (service role) can touch it

create table if not exists public.usage_global (day date primary key, calls int not null default 0);
alter table public.usage_global enable row level security;

create table if not exists public.flags (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users(id) on delete cascade,
  question text, reply text, reason text,
  reviewed boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.flags enable row level security;

-- Atomic cap check + increment. Returns 'ok', 'day', 'burst' or 'global'.
create or replace function public.bump_usage(uid uuid, kind text, tz text, day_cap int, burst_cap int, burst_min int, global_cap int)
returns text language plpgsql security definer set search_path = public as $$
declare d date := (now() at time zone tz)::date; u usage%rowtype; g int;
begin
  insert into usage (user_id, day) values (uid, d) on conflict do nothing;
  select * into u from usage where user_id = uid and day = d for update;
  insert into usage_global (day) values (d) on conflict do nothing;
  select calls into g from usage_global where day = d for update;
  if g >= global_cap then return 'global'; end if;
  if kind = 'coach' then
    if u.coach >= day_cap then return 'day'; end if;
    if (select count(*) from unnest(u.recent) t where t > now() - make_interval(mins => burst_min)) >= burst_cap then return 'burst'; end if;
    update usage set coach = coach + 1,
      recent = array(select t from unnest(u.recent || now()) t where t > now() - make_interval(mins => burst_min))
      where user_id = uid and day = d;
  else
    if u.est >= day_cap then return 'day'; end if;
    update usage set est = est + 1 where user_id = uid and day = d;
  end if;
  update usage_global set calls = calls + 1 where day = d;
  return 'ok';
end $$;
revoke execute on function public.bump_usage(uuid, text, text, int, int, int, int) from public, anon, authenticated;
grant execute on function public.bump_usage(uuid, text, text, int, int, int, int) to service_role;

-- ---------- Make yourself an admin (run after you sign up, with your email) ----------
-- update public.profiles set is_admin = true, tier = 'longevity'
--   where id = (select id from auth.users where email = 'you@example.com');
