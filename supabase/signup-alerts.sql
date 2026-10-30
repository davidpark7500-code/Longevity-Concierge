-- New sign-up email alerts to admins (applied 2026-10-30 as migration "signup_alerts").
-- Fires when someone finishes onboarding (accepted_at goes from empty to set).
-- The edge function route /api/signup-alert emails every admin about sign-ups not yet announced.
-- Requires the RESEND_API_KEY edge function secret.
create extension if not exists pg_net with schema extensions;
alter table public.profiles add column if not exists signup_notified_at timestamptz;
create or replace function public.notify_signup() returns trigger
language plpgsql security definer set search_path = public, extensions as $$
begin
  if new.accepted_at is not null and old.accepted_at is null and new.signup_notified_at is null then
    perform net.http_post(
      url := 'https://ptsneanksrzmzurfxvph.supabase.co/functions/v1/api/signup-alert',
      body := '{}'::jsonb,
      headers := '{"Content-Type":"application/json"}'::jsonb);
  end if;
  return new;
end $$;
revoke execute on function public.notify_signup() from public, anon, authenticated;
drop trigger if exists profiles_signup_alert on public.profiles;
create trigger profiles_signup_alert after update of accepted_at on public.profiles
  for each row execute function public.notify_signup();
