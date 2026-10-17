-- Apply before deploying the updated Worker and market-history Edge Function.
-- Only verified server-side registrations use these RPCs. No account/IP data is stored.
-- Security invoker preserves existing table access; clients cannot invoke either RPC.
create table if not exists public.history_registration_limits (
 bucket text primary key check (bucket in ('market', 'legacy:mtg', 'legacy:ygo')),
 window_start timestamptz not null,
 registrations integer not null check (registrations >= 0)
);
alter table public.history_registration_limits enable row level security;
revoke all on public.history_registration_limits from public, anon, authenticated;
grant select, insert, update on public.history_registration_limits to service_role;

create or replace function public.register_market_watch(g text, c text, f text, n text, s text)
returns text language plpgsql security invoker set search_path = '' as $$
declare
 current_window timestamptz;
 used integer;
begin
 if not coalesce(g in ('mtg', 'ptcg', 'ygo') and c ~ '^[a-zA-Z0-9.!%?_:-]{1,89}$'
   and f ~ '^[a-zA-Z0-9:_-]{1,99}$' and char_length(n) between 1 and 300 and char_length(s) <= 89
   and (g <> 'mtg' or (c ~ '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$' and f in ('nonfoil','foil','etched')))
   and (g <> 'ygo' or (c ~ '^[1-9][0-9]{0,9}$' and f = 'reference')), false)
 then raise exception 'invalid watch'; end if;
 -- Counts, expiration, rate reservation and insertion share one transaction/lock.
 -- This table lock also conflicts with any older direct insert/update writer.
 lock table public.market_watch in share row exclusive mode;
 current_window := date_trunc('minute', clock_timestamp());
 delete from public.market_watch where touched_at < now() - interval '120 days';
 if exists (select 1 from public.market_watch w where w.game = g and w.card_id = c and w.finish = f) then
  update public.market_watch w set name = n, set_code = s, touched_at = now()
   where w.game = g and w.card_id = c and w.finish = f;
  return 'registered';
 end if;
 if (select count(*) from public.market_watch) >= 3000 then return 'capacity'; end if;
 insert into public.history_registration_limits as limits(bucket, window_start, registrations)
 values ('market', current_window, 0)
 on conflict (bucket) do update set
  registrations = case when limits.window_start = excluded.window_start then limits.registrations else 0 end,
  window_start = excluded.window_start;
 select registrations into used from public.history_registration_limits where bucket = 'market';
 if used >= 60 then return 'rate_limited'; end if;
 insert into public.market_watch(game, card_id, finish, name, set_code, touched_at)
 values (g, c, f, n, s, now());
 update public.history_registration_limits set registrations = registrations + 1 where bucket = 'market';
 return 'registered';
end $$;
revoke all on function public.register_market_watch(text,text,text,text,text) from public, anon, authenticated;
grant execute on function public.register_market_watch(text,text,text,text,text) to service_role;

create or replace function public.register_price_watch(g text, ids text[])
returns text language plpgsql security invoker set search_path = '' as $$
declare
 current_window timestamptz;
 needed integer;
 used integer;
 bucket_name text := 'legacy:' || g;
begin
 if not coalesce(g in ('mtg', 'ygo') and cardinality(ids) between 1 and 300, false)
  or exists (select 1 from unnest(ids) as requested(id) where id is null or not
   (case when g = 'mtg' then id ~ '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$'
    else id ~ '^[1-9][0-9]{0,9}$' end))
 then raise exception 'invalid watch'; end if;
 lock table public.price_watch in share row exclusive mode;
 current_window := date_trunc('minute', clock_timestamp());
 delete from public.price_watch where last_seen < current_date - 120;
 select count(*) into needed from (select distinct id from unnest(ids) as requested(id)) requested
  where not exists (select 1 from public.price_watch w where w.game = g and w.card_id = requested.id);
 -- Each game's cap is independent, as are its daily recording fetches.
 if needed > 0 and (select count(*) from public.price_watch w where w.game = g) + needed > 10000 then return 'capacity'; end if;
 if needed > 0 then
  insert into public.history_registration_limits as limits(bucket, window_start, registrations)
  values (bucket_name, current_window, 0)
  on conflict (bucket) do update set
   registrations = case when limits.window_start = excluded.window_start then limits.registrations else 0 end,
   window_start = excluded.window_start;
  select registrations into used from public.history_registration_limits where bucket = bucket_name;
  if used + needed > 300 then return 'rate_limited'; end if;
 end if;
 insert into public.price_watch as target(game, card_id, last_seen)
 select g, id, current_date from (select distinct id from unnest(ids) as requested(id)) requested
 on conflict (game, card_id) do update set last_seen = excluded.last_seen;
 if needed > 0 then
  update public.history_registration_limits set registrations = registrations + needed where bucket = bucket_name;
 end if;
 return 'registered';
end $$;
revoke all on function public.register_price_watch(text,text[]) from public, anon, authenticated;
grant execute on function public.register_price_watch(text,text[]) to service_role;
