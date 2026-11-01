-- Play holo copies (Randall 2026-11-01 20:37Z: "Packs, or 2 seals at the Forge").
-- play.cards.holo = how many of the copies you own are holo (never more than count).
-- Packs: a foil pull adds a holo copy; with 4 copies already, it turns one of them holo instead of
-- melting. The Forge turns one owned copy holo for 2 seals of its rarity (delta "holo": [oracle ids]).
-- play_state now sends "h" per card. Safe to re-run.
alter table play.cards add column if not exists holo int not null default 0;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'play_cards_holo_range') then
    alter table play.cards add constraint play_cards_holo_range check (holo >= 0 and holo <= count);
  end if;
end $$;

create or replace function play.apply(p_user uuid, p_ref text, p_kind text, p_delta jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  w play.wallet;
  cfg jsonb;
  c jsonb;
  have int;
  holo_have int;
  extra_coins int := 0;
  converted jsonb := '[]'::jsonb;
  pk jsonb;
  opened play.packs;
begin
  if p_user is null or p_ref is null then raise exception 'bad_request'; end if;
  insert into play.ledger (user_id, ref, kind, delta) values (p_user, p_ref, p_kind, p_delta)
    on conflict (user_id, ref) do nothing;
  if not found then return jsonb_build_object('duplicate', true); end if;

  select data into cfg from play.config where id = 1;
  insert into play.wallet (user_id) values (p_user) on conflict do nothing;
  select * into w from play.wallet where user_id = p_user for update;

  if coalesce((p_delta->>'starter')::boolean, false) then
    if w.starter_at is not null then raise exception 'starter_taken'; end if;
    update play.wallet set starter_at = now() where user_id = p_user;
  end if;

  if p_delta ? 'open' then
    update play.packs set opened_at = now(), contents = p_delta->'open'->'contents'
      where id = (p_delta->'open'->>'id')::bigint and user_id = p_user and opened_at is null
      returning * into opened;
    if opened.id is null then raise exception 'pack_not_found'; end if;
    update play.wallet set packs_opened = packs_opened + 1 where user_id = p_user;
  end if;

  for pk in select * from jsonb_array_elements(coalesce(p_delta->'packs', '[]'::jsonb)) loop
    insert into play.packs (user_id, set_code, source) values (p_user, pk->>'set', coalesce(pk->>'source', p_kind));
  end loop;

  for c in select * from jsonb_array_elements(coalesce(p_delta->'cards', '[]'::jsonb)) loop
    insert into play.cards (user_id, oracle_id, name, rarity, count)
      values (p_user, (c->>'oracle_id')::uuid, coalesce(c->>'name', ''), coalesce(c->>'rarity', 'common'), 0)
      on conflict (user_id, oracle_id) do nothing;
    -- Remember which sets the card was pulled from (set progress) and the first printing seen.
    if coalesce(c->>'set', '') ~ '^[a-z0-9]{2,8}$' then
      update play.cards set sets = case when (c->>'set') = any(sets) then sets else sets || (c->>'set') end,
        print = case when print = '{}'::jsonb and coalesce(c->>'image', '') <> '' then jsonb_build_object('id', c->>'id', 'set', c->>'set', 'image', c->>'image') else print end
        where user_id = p_user and oracle_id = (c->>'oracle_id')::uuid;
    end if;
    select count, holo into have, holo_have from play.cards where user_id = p_user and oracle_id = (c->>'oracle_id')::uuid for update;
    if coalesce((c->>'foil')::boolean, false) and have >= 4 and holo_have < have then
      -- A holo pulled when you already hold 4 copies turns one of them holo instead of melting.
      update play.cards set holo = holo + 1 where user_id = p_user and oracle_id = (c->>'oracle_id')::uuid;
    elsif have >= 4 then
      extra_coins := extra_coins + coalesce((cfg->'duplicates'->>(c->>'rarity'))::int, 0);
      if c->>'rarity' = 'mythic' then
        update play.wallet set mythic_shards = mythic_shards + 1 where user_id = p_user;
        update play.wallet set seal_m = seal_m + 1, mythic_shards = mythic_shards - greatest(coalesce((cfg->>'mythicDuplicateShards')::int, 4), 1)
          where user_id = p_user and mythic_shards >= greatest(coalesce((cfg->>'mythicDuplicateShards')::int, 4), 1);
      end if;
      converted := converted || jsonb_build_array(c->>'oracle_id');
    else
      update play.cards set count = count + 1, holo = holo + case when coalesce((c->>'foil')::boolean, false) then 1 else 0 end
        where user_id = p_user and oracle_id = (c->>'oracle_id')::uuid;
    end if;
  end loop;

  -- Holo at the Forge: each oracle id listed turns one copy you own holo (never more holos than copies).
  for c in select * from jsonb_array_elements(coalesce(p_delta->'holo', '[]'::jsonb)) loop
    update play.cards set holo = holo + 1 where user_id = p_user and oracle_id = (c#>>'{}')::uuid and holo < count;
    if not found then raise exception 'no_copy'; end if;
  end loop;

  update play.wallet set
    coins = coins + coalesce((p_delta->>'coins')::int, 0) + extra_coins,
    seal_c = seal_c + coalesce((p_delta->'seals'->>'c')::int, 0),
    seal_u = seal_u + coalesce((p_delta->'seals'->>'u')::int, 0),
    seal_r = seal_r + coalesce((p_delta->'seals'->>'r')::int, 0),
    seal_m = seal_m + coalesce((p_delta->'seals'->>'m')::int, 0),
    xp = xp + greatest(coalesce((p_delta->>'xp')::int, 0), 0),
    updated_at = now()
  where user_id = p_user returning * into w;   -- a short balance fails the check constraints and rolls back

  if extra_coins > 0 then
    update play.ledger set delta = delta || jsonb_build_object('duplicate_coins', extra_coins, 'converted', converted)
      where user_id = p_user and ref = p_ref;
  end if;
  return to_jsonb(w) || jsonb_build_object('duplicate_coins', extra_coins, 'converted', converted);
end;
$$;
revoke all on function play.apply(uuid, text, text, jsonb) from public, anon, authenticated;
grant execute on function play.apply(uuid, text, text, jsonb) to service_role;

create or replace function public.play_state(p_user uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'config', (select data from play.config where id = 1),
    'wallet', (select to_jsonb(w) - 'user_id' from play.wallet w where w.user_id = p_user),
    'packs', coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'set', p.set_code, 'source', p.source, 'at', p.granted_at) order by p.id)
                        from play.packs p where p.user_id = p_user and p.opened_at is null), '[]'::jsonb),
    'cards', coalesce((select jsonb_agg(jsonb_build_object('o', c.oracle_id, 'n', c.name, 'r', c.rarity, 'c', c.count, 'h', c.holo, 's', c.sets, 'p', c.print))
                        from play.cards c where c.user_id = p_user and c.count > 0), '[]'::jsonb),
    'decks', coalesce((select jsonb_agg(jsonb_build_object('id', d.id, 'name', d.name, 'format', d.format, 'cards', d.cards, 'at', d.updated_at) order by d.updated_at desc)
                        from play.decks d where d.user_id = p_user), '[]'::jsonb)
  );
$$;
revoke all on function public.play_state(uuid) from public, anon, authenticated;
grant execute on function public.play_state(uuid) to service_role;

