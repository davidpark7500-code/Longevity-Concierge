-- Security + performance hardening (run after schema.sql). Safe to re-run.

-- 1. Trigger functions are not meant to be called through the API.
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.assign_group()   from public, anon, authenticated;
revoke execute on function public.post_defaults()  from public, anon, authenticated;
revoke execute on function public.cheer_count()    from public, anon, authenticated;

-- 2. has_circle only answers for the signed-in member (no peeking at other members).
create or replace function public.has_circle(uid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select uid = auth.uid() and coalesce((select circle_active or tier in ('performance','longevity') from profiles where id = uid), false);
$$;
revoke execute on function public.has_circle(uuid) from public, anon;
grant execute on function public.has_circle(uuid) to authenticated;

-- 3. Policies: evaluate auth.uid() once per query, not once per row.
drop policy if exists "own profile read" on public.profiles;
create policy "own profile read" on public.profiles for select using ((select auth.uid()) = id);
drop policy if exists "own profile update" on public.profiles;
create policy "own profile update" on public.profiles for update using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

drop policy if exists "own state" on public.user_state;
create policy "own state" on public.user_state for all using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy if exists "groups readable" on public.groups;
-- Group details (including the call link) are visible only to that group's members.
create policy "groups readable" on public.groups for select using (
  id = (select p.group_id from public.profiles p where p.id = (select auth.uid()))
);

drop policy if exists "read posts" on public.posts;
create policy "read posts" on public.posts for select using (
  (select auth.role()) = 'authenticated' and (
    group_id is null
    or ((select public.has_circle((select auth.uid()))) and group_id = (select p.group_id from public.profiles p where p.id = (select auth.uid())))
  )
);
drop policy if exists "circle members post" on public.posts;
create policy "circle members post" on public.posts for insert with check (
  (select public.has_circle((select auth.uid()))) and (
    group_id is null or group_id = (select p.group_id from public.profiles p where p.id = (select auth.uid()))
  )
);
drop policy if exists "delete own posts" on public.posts;
create policy "delete own posts" on public.posts for delete using (
  user_id = (select auth.uid()) or exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_admin)
);

drop policy if exists "read own cheers" on public.cheers;
create policy "read own cheers" on public.cheers for select using (user_id = (select auth.uid()));
drop policy if exists "cheer visible posts" on public.cheers;
create policy "cheer visible posts" on public.cheers for insert with check (
  user_id = (select auth.uid()) and exists (select 1 from public.posts where id = post_id)
);
drop policy if exists "uncheer" on public.cheers;
create policy "uncheer" on public.cheers for delete using (user_id = (select auth.uid()));

-- 4. Indexes for foreign keys.
create index if not exists cheers_user_idx   on public.cheers (user_id);
create index if not exists flags_user_idx    on public.flags (user_id);
create index if not exists posts_user_idx    on public.posts (user_id);
create index if not exists profiles_group_idx on public.profiles (group_id);
