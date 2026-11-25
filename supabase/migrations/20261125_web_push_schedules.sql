-- 1. Create push_subscriptions table to store Web Push endpoints per user/device
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, endpoint)
);

alter table public.push_subscriptions enable row level security;

drop policy if exists "Users can view their own push subscriptions" on public.push_subscriptions;
create policy "Users can view their own push subscriptions"
  on public.push_subscriptions for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert their own push subscriptions" on public.push_subscriptions;
create policy "Users can insert their own push subscriptions"
  on public.push_subscriptions for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their own push subscriptions" on public.push_subscriptions;
create policy "Users can update their own push subscriptions"
  on public.push_subscriptions for update
  using (auth.uid() = user_id);

drop policy if exists "Users can delete their own push subscriptions" on public.push_subscriptions;
create policy "Users can delete their own push subscriptions"
  on public.push_subscriptions for delete
  using (auth.uid() = user_id);

-- 2. Track pushed notifications on schedules so each due schedule only pushes once
alter table public.schedules
  add column if not exists push_notified_at timestamptz;

create index if not exists idx_schedules_due_push
  on public.schedules (event_time)
  where is_completed = false and push_notified_at is null;

-- 3. Enable pg_cron and pg_net extensions (requires Supabase project privileges)
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- 4. Schedule check-schedules-push Edge Function every 1 minute
-- Note: Replace <YOUR_CRON_SECRET> with the same secret set via `supabase secrets set CRON_SECRET=...`
select cron.unschedule('check-schedules-push-every-minute')
where exists (
  select 1 from cron.job where jobname = 'check-schedules-push-every-minute'
);

select cron.schedule(
  'check-schedules-push-every-minute',
  '* * * * *',
  $$
  select net.http_post(
    url := 'https://ermsfysxuxnddjxbvtzw.supabase.co/functions/v1/check-schedules-push',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', '<YOUR_CRON_SECRET>'
    ),
    body := '{}'::jsonb
  );
  $$
);
