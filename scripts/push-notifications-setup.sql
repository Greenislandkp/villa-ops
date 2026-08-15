-- Villa Ops — daily task push notifications.
-- Already applied directly to the project via the Supabase MCP connector;
-- kept here for reference / reproducibility only, not meant to be re-run.

-- 1. Subscriptions (one row per device that enabled notifications)
create table if not exists push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  team_member_id uuid not null references team_members(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

alter table push_subscriptions enable row level security;

create policy "Users manage their own push subscriptions"
  on push_subscriptions for all
  using (team_member_id = auth.uid())
  with check (team_member_id = auth.uid());

-- 2. App-level secrets, readable only by the service_role used inside the
-- Edge Function (RLS enabled, no policies => blocked for anon/authenticated)
create table if not exists app_secrets (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);

alter table app_secrets enable row level security;

-- VAPID keypair + the shared secret the cron job uses to authorize its
-- call to the (verify_jwt = false) Edge Function. Values live only in the
-- Supabase project, not in this repo.
-- insert into app_secrets (key, value) values
--   ('vapid_public_key', '...'),
--   ('vapid_private_key', '...'),
--   ('vapid_subject', 'mailto:...'),
--   ('cron_secret', '...');

-- 3. Daily schedule: 03:00 UTC = 10:00 Asia/Bangkok
create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

select cron.schedule(
  'daily-task-notifications',
  '0 3 * * *',
  $$
  select net.http_post(
    url := 'https://ohmercemusyijkipquld.supabase.co/functions/v1/send-daily-task-notifications',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select value from app_secrets where key = 'cron_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 20000
  );
  $$
);

-- The Edge Function itself (send-daily-task-notifications) is deployed
-- separately via `supabase functions deploy` / the Supabase dashboard —
-- see the project's Edge Functions list.
