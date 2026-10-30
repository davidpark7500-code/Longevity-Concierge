-- Articles (Learn tab) + admin powers for articles and challenges. Safe to re-run.

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select is_admin from profiles where id = auth.uid()), false);
$$;
revoke execute on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

create table if not exists public.articles (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 3 and 120),
  cat text not null default 'Nutrition' check (cat in ('Protein','Strength','Nutrition','Mindset','Provider','Sleep')),
  minutes int not null default 4 check (minutes between 1 and 30),
  icon text not null default 'protein',
  summary text check (char_length(summary) <= 240),
  body text not null default '' check (char_length(body) <= 20000),
  sources text check (char_length(sources) <= 4000),
  published boolean not null default false,
  sort int not null default 100,
  author_id uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.articles enable row level security;
drop policy if exists "read articles" on public.articles;
create policy "read articles" on public.articles for select using (
  (select auth.role()) = 'authenticated' and (published or (select public.is_admin()))
);
drop policy if exists "admins write articles" on public.articles;
create policy "admins write articles" on public.articles for all
  using ((select public.is_admin())) with check ((select public.is_admin()));
create or replace function public.touch_updated() returns trigger language plpgsql set search_path = public as $$
begin new.updated_at := now(); return new; end $$;
drop trigger if exists articles_touch on public.articles;
create trigger articles_touch before update on public.articles for each row execute function public.touch_updated();

-- Challenges: admins can create, edit and end them.
drop policy if exists "admins manage pacts" on public.pacts;
create policy "admins manage pacts" on public.pacts for all
  using ((select public.is_admin())) with check ((select public.is_admin()));
drop policy if exists "pacts readable" on public.pacts;
create policy "pacts readable" on public.pacts for select using (
  (select auth.role()) = 'authenticated' and (
    (select public.is_admin())
    or (active and (not members_only or (select public.has_circle((select auth.uid())))))
  )
);

-- Weekly calls: show "Weekly" until a day/time is set.
update public.groups set next_call = 'Weekly' where next_call is null or next_call = '';

-- Admins: David and Luis.
update public.profiles set is_admin = true
where id in (select id from auth.users where email in ('davidpark7500@gmail.com','luisramirez3416@gmail.com'));

-- One private Circle group for every package member (applied 2026-10-29).
create or replace function public.assign_group() returns trigger
language plpgsql security definer set search_path = public as $$
declare g uuid;
begin
  if new.group_id is null and (new.circle_active or new.tier in ('essentials','performance','longevity')) then
    select id into g from groups order by created_at limit 1;
    if g is null then insert into groups (name, next_call) values ('The Circle', 'Weekly') returning id into g; end if;
    new.group_id := g;
  end if;
  return new;
end $$;
revoke execute on function public.assign_group() from public, anon, authenticated;

-- Admins always have Circle access, whatever their package (applied 2026-10-29).
create or replace function public.has_circle(uid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select uid = auth.uid() and coalesce((select is_admin or circle_active or tier in ('essentials','performance','longevity') from profiles where id = uid), false);
$$;
-- (assign_group also treats is_admin as a Circle member.)
