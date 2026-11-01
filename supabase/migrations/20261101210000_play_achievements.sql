-- Play achievements, daily and weekly quests and the log-in calendar (play-achievements.md, slice 2).
-- Lifetime, per-day (d:YYYY-MM-DD:key) and per-week (w:YYYY-Www:key) counters, bumped by the server
-- from match reports and log-ins. Each bump is a play.ledger row with a unique ref, so one match or
-- one log-in day is never counted twice. Claims (ach:*, daily:*, weekly:*) are ordinary ledger rows
-- written by play.apply, so a reward is never paid twice either. Server only (service key).
create table if not exists play.counters (
  user_id uuid not null references auth.users (id) on delete cascade,
  key text not null check (length(key) between 1 and 80),
  value bigint not null default 0,
  primary key (user_id, key)
);
alter table play.counters enable row level security;
drop policy if exists "Play counters: read own" on play.counters;
create policy "Play counters: read own" on play.counters for select to authenticated using ((select auth.uid()) = user_id);
grant select on play.counters to authenticated;

-- The player's counters; day counters only for the last 3 days and week counters for the last 3 weeks.
create or replace function public.play_counters(p_user uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_object_agg(c.key, c.value), '{}'::jsonb) from play.counters c
  where c.user_id = p_user
    and (c.key not like 'd:%' or c.key >= 'd:' || to_char((now() at time zone 'utc')::date - 2, 'YYYY-MM-DD'))
    and (c.key not like 'w:%' or c.key >= 'w:' || to_char((now() at time zone 'utc')::date - 21, 'IYYY-"W"IW'));
$$;

-- Adds counters once per ref. Returns {duplicate, counters}.
create or replace function public.play_bump(p_user uuid, p_ref text, p_kind text, p_counters jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare k text; v text;
begin
  insert into play.ledger (user_id, ref, kind, delta) values (p_user, p_ref, p_kind, jsonb_build_object('counters', p_counters))
    on conflict (user_id, ref) do nothing;
  if not found then return jsonb_build_object('duplicate', true, 'counters', public.play_counters(p_user)); end if;
  for k, v in select e.key, e.value from jsonb_each_text(coalesce(p_counters, '{}'::jsonb)) e loop
    if v ~ '^[0-9]{1,6}$' and length(k) between 1 and 80 then
      insert into play.counters (user_id, key, value) values (p_user, k, v::bigint)
        on conflict (user_id, key) do update set value = play.counters.value + excluded.value;
    end if;
  end loop;
  return jsonb_build_object('duplicate', false, 'counters', public.play_counters(p_user));
end;
$$;

-- Rewards already claimed: every achievement step, and this and last week's quests.
create or replace function public.play_claims(p_user uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(l.ref), '[]'::jsonb) from play.ledger l
  where l.user_id = p_user
    and (l.ref like 'ach:%' or ((l.ref like 'daily:%' or l.ref like 'weekly:%') and l.at > now() - interval '15 days'));
$$;

revoke all on function public.play_counters(uuid) from public, anon, authenticated;
revoke all on function public.play_bump(uuid, text, text, jsonb) from public, anon, authenticated;
revoke all on function public.play_claims(uuid) from public, anon, authenticated;
grant execute on function public.play_counters(uuid) to service_role;
grant execute on function public.play_bump(uuid, text, text, jsonb) to service_role;
grant execute on function public.play_claims(uuid) to service_role;
