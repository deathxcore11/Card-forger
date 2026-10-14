create or replace function public.merge_market_batch(rows jsonb)
returns void language plpgsql security invoker set search_path='' as $$
begin
 if jsonb_typeof(rows) <> 'array' or jsonb_array_length(rows)>100 then raise exception 'invalid batch'; end if;
 if exists(select 1 from jsonb_array_elements(rows) as a(r)
   where r->>'game' not in ('mtg','ptcg','ygo') or r->>'card_id' is null or r->>'finish' is null
   or jsonb_typeof(r->'points') <> 'array' or jsonb_array_length(r->'points')>366)
 then raise exception 'invalid series'; end if;
 with incoming as (
  select distinct on (r->>'game',r->>'card_id',r->>'finish',r->>'source') r
  from jsonb_array_elements(rows) with ordinality as a(r,n)
  order by r->>'game',r->>'card_id',r->>'finish',r->>'source',n desc
 )
 insert into public.market_series as target(game,card_id,finish,source,currency,points)
 select r->>'game',r->>'card_id',r->>'finish',r->>'source','USD',
 (select coalesce(jsonb_agg(point order by day),'[]'::jsonb) from
  (select distinct on(point->>'date') point,point->>'date' as day
   from jsonb_array_elements(r->'points') with ordinality as b(point,n)
   where (point->>'date')::date between current_date-365 and current_date
   and (point->>'value')::numeric between 0 and 10000000
   order by point->>'date',n desc) dated)
 from incoming
 on conflict(game,card_id,finish,source,currency) do update
 set points=(select coalesce(jsonb_agg(point order by day),'[]'::jsonb) from
  (select distinct on(point->>'date') point,point->>'date' as day
   from jsonb_array_elements(target.points || excluded.points) with ordinality as a(point,n)
   where (point->>'date')::date between current_date-365 and current_date
   and (point->>'value')::numeric between 0 and 10000000
   order by point->>'date',n desc) dated),updated_at=now();
end $$;
revoke all on function public.merge_market_batch(jsonb) from public,anon,authenticated;
grant execute on function public.merge_market_batch(jsonb) to service_role;
