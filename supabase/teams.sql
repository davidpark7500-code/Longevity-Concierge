-- Concierge teams: every member belongs to the promoter whose link they signed up through.
-- Circle groups form only inside a team. Run after schema.sql and hardening.sql. Safe to re-run.

create table if not exists public.concierges (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null check (slug ~ '^[a-z0-9-]{2,30}$'),
  name text not null check (char_length(name) between 1 and 60),
  contact_url text check (contact_url is null or contact_url ~ '^(https://|sms:|tel:|mailto:)'),
  contact_label text check (char_length(contact_label) <= 40),
  user_id uuid unique references auth.users(id) on delete set null,   -- the concierge's own login
  is_house boolean not null default false,                            -- signups with no link land here
  active boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.concierges enable row level security;
create unique index if not exists concierges_one_house on public.concierges (is_house) where is_house;

alter table public.profiles add column if not exists concierge_id uuid references public.concierges(id) on delete set null;
alter table public.groups   add column if not exists concierge_id uuid references public.concierges(id) on delete cascade;
create index if not exists profiles_concierge_idx on public.profiles (concierge_id);
create index if not exists groups_concierge_idx   on public.groups (concierge_id);
create index if not exists concierges_user_idx    on public.concierges (user_id);

-- The house team (David). Existing members and groups join it.
insert into public.concierges (slug, name, is_house, user_id)
select 'david', 'David Park', true, (select id from auth.users where email = 'davidpark7500@gmail.com')
where not exists (select 1 from public.concierges where is_house);
update public.profiles set concierge_id = (select id from public.concierges where is_house) where concierge_id is null;
update public.groups   set concierge_id = (select id from public.concierges where is_house) where concierge_id is null;

-- Members see their own concierge; a concierge sees their own row.
drop policy if exists "my concierge" on public.concierges;
create policy "my concierge" on public.concierges for select using (
  id = (select p.concierge_id from public.profiles p where p.id = (select auth.uid()))
  or user_id = (select auth.uid())
);

-- Public lookup for the join page: name only, active teams only.
create or replace function public.concierge_public(s text) returns table (name text)
language sql stable security definer set search_path = public as $$
  select c.name from concierges c where c.slug = lower(s) and c.active;
$$;
revoke execute on function public.concierge_public(text) from public;
grant execute on function public.concierge_public(text) to anon, authenticated;

-- New signups: attach to the team from their link (sent as sign-up metadata), else the house team.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare c uuid;
begin
  select id into c from concierges where slug = lower(coalesce(new.raw_user_meta_data->>'ref', '')) and active;
  if c is null then select id into c from concierges where is_house; end if;
  insert into public.profiles (id, concierge_id) values (new.id, c) on conflict do nothing;
  return new;
end $$;
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- Circle groups: only with people from the same team.
create or replace function public.assign_group() returns trigger
language plpgsql security definer set search_path = public as $$
declare g uuid; n int; team uuid;
begin
  team := coalesce(new.concierge_id, (select id from concierges where is_house));
  if new.group_id is not null and (tg_op = 'INSERT' or new.concierge_id is distinct from old.concierge_id) then
    if (select concierge_id from groups where id = new.group_id) is distinct from team then new.group_id := null; end if;
  end if;
  if new.group_id is null and (new.circle_active or new.tier in ('performance','longevity')) then
    select gr.id into g from groups gr
      left join profiles p on p.group_id = gr.id
      where gr.concierge_id = team
      group by gr.id, gr.max_members, gr.created_at
      having count(p.id) < gr.max_members
      order by count(p.id) asc, gr.created_at asc limit 1;
    if g is null then
      select count(*) + 1 into n from groups where concierge_id = team;
      insert into groups (name, concierge_id) values ((select split_part(name, ' ', 1) from concierges where id = team) || '''s Circle ' || n, team) returning id into g;
    end if;
    new.group_id := g;
  end if;
  return new;
end $$;
revoke execute on function public.assign_group() from public, anon, authenticated;

-- Members can't change their own team (only first_name and accepted_at are writable, from schema.sql).

-- Group details (including the call link) are visible only to that group's members and their concierge.
drop policy if exists "groups readable" on public.groups;
create policy "groups readable" on public.groups for select using (
  id = (select p.group_id from public.profiles p where p.id = (select auth.uid()))
  or concierge_id in (select c.id from public.concierges c where c.user_id = (select auth.uid()))
);
