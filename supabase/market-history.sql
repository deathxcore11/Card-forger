-- Market facts only. No account IDs, quantities, collections or ownership.
create table if not exists public.market_watch (
 game text not null check (game in ('mtg','ptcg','ygo')),
 card_id text not null, finish text not null,
 set_code text, name text not null, touched_at timestamptz not null default now(),
 primary key(game,card_id,finish)
);
create table if not exists public.market_series (
 game text not null, card_id text not null, finish text not null,
 source text not null, currency text not null check(currency='USD'),
 points jsonb not null default '[]' check(jsonb_typeof(points)='array'),
 updated_at timestamptz not null default now(),
 primary key(game,card_id,finish,source,currency)
);
alter table public.market_watch enable row level security;
alter table public.market_series enable row level security;
revoke all on public.market_watch,public.market_series from anon,authenticated;
grant select on public.market_watch,public.market_series to anon,authenticated;
grant all on public.market_watch,public.market_series to service_role;
create policy "Public market watch metadata" on public.market_watch for select to anon,authenticated using(true);
create policy "Public market observations" on public.market_series for select to anon,authenticated using(true);
-- Only trusted ingestion can merge. One dated quote per source/printing/finish.
create or replace function public.merge_market_series(g text,c text,f text,s text,p jsonb)
returns void language plpgsql security invoker set search_path='' as $$
begin
 if g not in ('mtg','ptcg','ygo') or jsonb_array_length(p)>400 then raise exception 'invalid series'; end if;
 insert into public.market_series as target(game,card_id,finish,source,currency,points)
 values(g,c,f,s,'USD',p)
 on conflict(game,card_id,finish,source,currency) do update
 set points=(select coalesce(jsonb_agg(point order by day),'[]'::jsonb) from
 (select distinct on (point->>'date') point,point->>'date' as day from
 jsonb_array_elements(target.points || excluded.points) with ordinality as a(point,n)
 where (point->>'date')::date >= current_date-365 and (point->>'date')::date <= current_date
 and (point->>'value')::numeric >= 0
 order by point->>'date',n desc) dated),updated_at=now();
end $$;
revoke all on function public.merge_market_series(text,text,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.merge_market_series(text,text,text,text,jsonb) to service_role;
create index if not exists market_watch_recent on public.market_watch(touched_at desc);
