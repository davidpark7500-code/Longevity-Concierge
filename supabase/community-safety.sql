-- Community safety: report posts, block users (Apple guideline 1.2). Applied 2026-10-30.
create table if not exists public.blocks (
  blocker uuid not null default auth.uid() references auth.users(id) on delete cascade,
  blocked uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker, blocked),
  blocked_name text,
  check (blocker <> blocked)
);
alter table public.blocks enable row level security;
create policy "my blocks" on public.blocks for select using (blocker = (select auth.uid()));
create policy "block someone" on public.blocks for insert with check (blocker = (select auth.uid()));
create policy "unblock" on public.blocks for delete using (blocker = (select auth.uid()));

-- Reports are written and read only by the server function (service role), which also emails admins.
create table if not exists public.reports (
  id bigserial primary key,
  post_id uuid references public.posts(id) on delete set null,
  reporter uuid references auth.users(id) on delete set null,
  author_id uuid, author_name text, post_body text, reason text,
  resolved boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.reports enable row level security;
create index if not exists reports_open on public.reports (resolved, created_at desc);

-- Posts from people you blocked are hidden from you.
drop policy "read posts" on public.posts;
create policy "read posts" on public.posts for select using (
  ((select auth.role()) = 'authenticated')
  and ((group_id is null) or ((select has_circle((select auth.uid()))) and group_id = (select p.group_id from profiles p where p.id = (select auth.uid()))))
  and not exists (select 1 from public.blocks b where b.blocker = (select auth.uid()) and b.blocked = posts.user_id)
);
