-- Crash reports, Planeswalk cloud saves and the Planeswalk run log.
-- Run once in Supabase → SQL Editor. The app works without it: every call fails quietly.
--
-- app_errors and planeswalk_runs are write-only for clients (through the two functions
-- below, which cap sizes and volume). Only the dashboard/service role reads them, except that
-- a signed-in player can read their own runs. planeswalk_saves is one row per account,
-- readable and writable only by its owner, and is removed with the account.

create table if not exists public.app_errors (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  user_id uuid references auth.users (id) on delete set null,
  app text not null,
  version text not null,
  platform text not null,
  screen text not null default '',
  message text not null,
  stack text not null default '',
  trail jsonb not null default '[]'::jsonb,
  device text not null default ''
);
create index if not exists app_errors_created_idx on public.app_errors (created_at desc);
alter table public.app_errors enable row level security;
revoke all on public.app_errors from anon, authenticated;

create or replace function public.log_client_error(p jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Hard cap so a crash loop on many devices can't flood the table.
  if (select count(*) from public.app_errors where created_at > now() - interval '10 minutes') >= 500 then
    return;
  end if;
  insert into public.app_errors (user_id, app, version, platform, screen, message, stack, trail, device)
  values (
    auth.uid(),
    left(coalesce(p->>'app', ''), 40),
    left(coalesce(p->>'version', ''), 40),
    left(coalesce(p->>'platform', ''), 40),
    left(coalesce(p->>'screen', ''), 120),
    left(coalesce(p->>'message', ''), 500),
    left(coalesce(p->>'stack', ''), 4000),
    case when jsonb_typeof(p->'trail') = 'array' and length((p->'trail')::text) <= 4000 then p->'trail' else '[]'::jsonb end,
    left(coalesce(p->>'device', ''), 200)
  );
end;
$$;
revoke all on function public.log_client_error(jsonb) from public;
grant execute on function public.log_client_error(jsonb) to anon, authenticated;

create table if not exists public.planeswalk_saves (
  user_id uuid primary key references auth.users (id) on delete cascade,
  data jsonb not null,
  device text not null default '',
  updated_at timestamptz not null default now(),
  constraint planeswalk_saves_size check (length(data::text) <= 524288)
);
alter table public.planeswalk_saves enable row level security;
drop policy if exists "Planeswalk saves: read own" on public.planeswalk_saves;
create policy "Planeswalk saves: read own" on public.planeswalk_saves
  for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "Planeswalk saves: insert own" on public.planeswalk_saves;
create policy "Planeswalk saves: insert own" on public.planeswalk_saves
  for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists "Planeswalk saves: update own" on public.planeswalk_saves;
create policy "Planeswalk saves: update own" on public.planeswalk_saves
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists "Planeswalk saves: delete own" on public.planeswalk_saves;
create policy "Planeswalk saves: delete own" on public.planeswalk_saves
  for delete to authenticated using ((select auth.uid()) = user_id);
grant select, insert, update, delete on public.planeswalk_saves to authenticated;

create table if not exists public.planeswalk_runs (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  user_id uuid references auth.users (id) on delete cascade,
  version text not null default '',
  hero text not null default '',
  seed text not null default '',
  act int not null default 0,
  floor int not null default 0,
  won boolean not null default false,
  killed_by text not null default '',
  best_turn int not null default 0,
  turns int not null default 0,
  deck jsonb not null default '[]'::jsonb,
  emblems jsonb not null default '[]'::jsonb,
  offers jsonb not null default '[]'::jsonb
);
create index if not exists planeswalk_runs_user_idx on public.planeswalk_runs (user_id, created_at desc);
create index if not exists planeswalk_runs_created_idx on public.planeswalk_runs (created_at desc);
alter table public.planeswalk_runs enable row level security;
revoke all on public.planeswalk_runs from anon, authenticated;
drop policy if exists "Planeswalk runs: read own" on public.planeswalk_runs;
create policy "Planeswalk runs: read own" on public.planeswalk_runs
  for select to authenticated using ((select auth.uid()) = user_id);
grant select on public.planeswalk_runs to authenticated;

create or replace function public.log_planeswalk_run(p jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  arr jsonb;
begin
  if (select count(*) from public.planeswalk_runs where created_at > now() - interval '10 minutes') >= 300 then
    return;
  end if;
  insert into public.planeswalk_runs (user_id, version, hero, seed, act, floor, won, killed_by, best_turn, turns, deck, emblems, offers)
  values (
    auth.uid(),
    left(coalesce(p->>'version', ''), 40),
    left(coalesce(p->>'hero', ''), 40),
    left(coalesce(p->>'seed', ''), 80),
    least(greatest(coalesce((p->>'act')::int, 0), 0), 20),
    least(greatest(coalesce((p->>'floor')::int, 0), 0), 100),
    coalesce((p->>'won')::boolean, false),
    left(coalesce(p->>'killedBy', ''), 80),
    least(greatest(coalesce((p->>'bestTurn')::int, 0), 0), 100000),
    least(greatest(coalesce((p->>'turns')::int, 0), 0), 10000),
    case when jsonb_typeof(p->'deck') = 'array' and length((p->'deck')::text) <= 8000 then p->'deck' else '[]'::jsonb end,
    case when jsonb_typeof(p->'emblems') = 'array' and length((p->'emblems')::text) <= 4000 then p->'emblems' else '[]'::jsonb end,
    case when jsonb_typeof(p->'offers') = 'array' and length((p->'offers')::text) <= 24000 then p->'offers' else '[]'::jsonb end
  );
end;
$$;
revoke all on function public.log_planeswalk_run(jsonb) from public;
grant execute on function public.log_planeswalk_run(jsonb) to anon, authenticated;

-- Account deletion needs no change: saves and runs cascade from auth.users, crash reports are set to null.
