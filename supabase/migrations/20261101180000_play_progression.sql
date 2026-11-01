-- Play progression, slice 1: the Play collection, wallet (coins, wax seals, packs) and the ledger.
-- The wall: Play has its own schema. Nothing here reads or writes public.workspaces (the real
-- collection), and the real collection never reads this. Players can only READ their own rows;
-- every grant and spend goes through play.apply(), which only the server (service role) may call,
-- so a player can't hand themselves packs by editing the app. Spec: play-progression.md.
-- Run once in Supabase → SQL Editor. Rows cascade away with the account (auth.users).

create schema if not exists play;
grant usage on schema play to authenticated, service_role;

-- Every reward value, in one row, so the economy can be retuned without a release.
create table if not exists play.config (
  id int primary key default 1 check (id = 1),
  data jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists play.wallet (
  user_id uuid primary key references auth.users (id) on delete cascade,
  coins int not null default 0 check (coins >= 0),
  seal_c int not null default 0 check (seal_c >= 0),
  seal_u int not null default 0 check (seal_u >= 0),
  seal_r int not null default 0 check (seal_r >= 0),
  seal_m int not null default 0 check (seal_m >= 0),
  packs_opened int not null default 0,
  mythic_shards int not null default 0 check (mythic_shards >= 0),
  xp int not null default 0,
  starter_at timestamptz,
  updated_at timestamptz not null default now()
);

-- Copies are counted by card name (oracle id), up to 4; any printing is a style.
create table if not exists play.cards (
  user_id uuid not null references auth.users (id) on delete cascade,
  oracle_id uuid not null,
  name text not null default '',
  rarity text not null default 'common' check (rarity in ('common','uncommon','rare','mythic')),
  count smallint not null default 0 check (count between 0 and 4),
  first_at timestamptz not null default now(),
  primary key (user_id, oracle_id)
);

create table if not exists play.packs (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  set_code text not null check (set_code ~ '^[a-z0-9]{2,8}$'),
  source text not null default '',
  granted_at timestamptz not null default now(),
  opened_at timestamptz,
  contents jsonb
);
create index if not exists play_packs_unopened_idx on play.packs (user_id) where opened_at is null;

-- Play decks are their own decks, never the real ones. Players may edit these directly:
-- a deck changes nothing in the economy, and matches check it against play.cards.
create table if not exists play.decks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null default '' check (length(name) <= 80),
  format text not null default '' check (length(format) <= 40),
  cards jsonb not null default '[]'::jsonb check (length(cards::text) <= 65536),
  updated_at timestamptz not null default now()
);
create index if not exists play_decks_user_idx on play.decks (user_id, updated_at desc);

-- Append-only record of every grant and spend. (user_id, ref) is unique, so a reward is never paid twice.
create table if not exists play.ledger (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  ref text not null check (length(ref) between 1 and 120),
  kind text not null,
  delta jsonb not null,
  at timestamptz not null default now(),
  unique (user_id, ref)
);

alter table play.config enable row level security;
alter table play.wallet enable row level security;
alter table play.cards enable row level security;
alter table play.packs enable row level security;
alter table play.decks enable row level security;
alter table play.ledger enable row level security;
revoke all on all tables in schema play from anon, authenticated;

drop policy if exists "Play config: read" on play.config;
create policy "Play config: read" on play.config for select to authenticated using (true);
drop policy if exists "Play wallet: read own" on play.wallet;
create policy "Play wallet: read own" on play.wallet for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "Play cards: read own" on play.cards;
create policy "Play cards: read own" on play.cards for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "Play packs: read own" on play.packs;
create policy "Play packs: read own" on play.packs for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "Play ledger: read own" on play.ledger;
create policy "Play ledger: read own" on play.ledger for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "Play decks: own" on play.decks;
create policy "Play decks: own" on play.decks for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

grant select on play.config, play.wallet, play.cards, play.packs, play.ledger to authenticated;
grant select, insert, update, delete on play.decks to authenticated;
grant all on all tables in schema play to service_role;

-- The one write path. Server only. delta:
--   {"coins":n, "seals":{"c":n,"u":n,"r":n,"m":n}, "xp":n, "starter":true,
--    "packs":[{"set":"fra","source":"weekly"}...],          packs granted
--    "open":{"id":123,"contents":[...]},                       a pack opened (contents rolled by the server)
--    "cards":[{"oracle_id":"…","name":"…","rarity":"rare"}...]} cards added (copies past 4 turn into coins)
-- Negative coins or seals are spends; they fail if the balance is short. Returns the new wallet,
-- or {"duplicate":true} when this ref was already applied.
create or replace function play.apply(p_user uuid, p_ref text, p_kind text, p_delta jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  w play.wallet;
  cfg jsonb;
  c jsonb;
  have int;
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
    select count into have from play.cards where user_id = p_user and oracle_id = (c->>'oracle_id')::uuid for update;
    if have >= 4 then
      -- Duplicate protection: the 5th copy and up turns into coins, and a mythic into a
      -- share of a mythic seal (mythicDuplicateShards of them make one seal).
      extra_coins := extra_coins + coalesce((cfg->'duplicates'->>(c->>'rarity'))::int, 0);
      if c->>'rarity' = 'mythic' then
        update play.wallet set mythic_shards = mythic_shards + 1 where user_id = p_user;
        update play.wallet set seal_m = seal_m + 1, mythic_shards = mythic_shards - greatest(coalesce((cfg->>'mythicDuplicateShards')::int, 4), 1)
          where user_id = p_user and mythic_shards >= greatest(coalesce((cfg->>'mythicDuplicateShards')::int, 4), 1);
      end if;
      converted := converted || jsonb_build_array(c->>'oracle_id');
    else
      update play.cards set count = count + 1 where user_id = p_user and oracle_id = (c->>'oracle_id')::uuid;
    end if;
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

-- The play schema is not exposed to the API. The worker reaches it only through these
-- public wrappers, and only with the service key; players never call them.
create or replace function public.play_apply(p_user uuid, p_ref text, p_kind text, p_delta jsonb)
returns jsonb language sql security definer set search_path = '' as $$
  select play.apply(p_user, p_ref, p_kind, p_delta);
$$;

-- Everything the Play homepage needs for one player, in one read.
create or replace function public.play_state(p_user uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'config', (select data from play.config where id = 1),
    'wallet', (select to_jsonb(w) - 'user_id' from play.wallet w where w.user_id = p_user),
    'packs', coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'set', p.set_code, 'source', p.source, 'at', p.granted_at) order by p.id)
                        from play.packs p where p.user_id = p_user and p.opened_at is null), '[]'::jsonb),
    'cards', coalesce((select jsonb_agg(jsonb_build_object('o', c.oracle_id, 'n', c.name, 'r', c.rarity, 'c', c.count))
                        from play.cards c where c.user_id = p_user and c.count > 0), '[]'::jsonb),
    'decks', coalesce((select jsonb_agg(jsonb_build_object('id', d.id, 'name', d.name, 'format', d.format, 'cards', d.cards, 'at', d.updated_at) order by d.updated_at desc)
                        from play.decks d where d.user_id = p_user), '[]'::jsonb)
  );
$$;

-- Save (insert or replace) or delete one Play deck. A deck never touches the wallet.
create or replace function public.play_save_deck(p_user uuid, p_id uuid, p_name text, p_format text, p_cards jsonb, p_delete boolean default false)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare d play.decks;
begin
  if p_delete then delete from play.decks where id = p_id and user_id = p_user; return jsonb_build_object('deleted', p_id); end if;
  if (select count(*) from play.decks where user_id = p_user) >= 100 and not exists (select 1 from play.decks where id = p_id and user_id = p_user) then raise exception 'deck_limit'; end if;
  insert into play.decks (id, user_id, name, format, cards, updated_at) values (coalesce(p_id, gen_random_uuid()), p_user, left(coalesce(p_name, ''), 80), left(coalesce(p_format, ''), 40), p_cards, now())
    on conflict (id) do update set name = excluded.name, format = excluded.format, cards = excluded.cards, updated_at = now()
    where play.decks.user_id = p_user
    returning * into d;
  if d.id is null then raise exception 'not_yours'; end if;
  return to_jsonb(d) - 'user_id';
end;
$$;

revoke all on function public.play_apply(uuid, text, text, jsonb) from public, anon, authenticated;
revoke all on function public.play_state(uuid) from public, anon, authenticated;
revoke all on function public.play_save_deck(uuid, uuid, text, text, jsonb, boolean) from public, anon, authenticated;
grant execute on function public.play_apply(uuid, text, text, jsonb) to service_role;
grant execute on function public.play_state(uuid) to service_role;
grant execute on function public.play_save_deck(uuid, uuid, text, text, jsonb, boolean) to service_role;

-- Starting values: a copy of data/play-economy.json (play-progression.md sections 3 and 4).
-- Edit this row to rebalance without a release. test-play-economy.mjs keeps the two in step.
insert into play.config (id, data) values (1, $config${"version":1,"note":"Play economy starting values (play-progression.md sections 3 and 4). The live copy is the play.config row in Supabase; edit that to rebalance without a release.","starter":{"packs":15,"coins":1000,"seals":{"c":0,"u":4,"r":3,"m":1},"starterDecks":true},"packPrice":500,"sealTrack":{"u":3,"r":5,"m":20},"duplicates":{"common":20,"uncommon":50,"rare":150,"mythic":0},"maxCopies":4,"daily":{"easy":{"coins":250,"xp":50},"hard":{"coins":500,"xp":100},"firstMatch":{"coins":100,"minTurns":5},"slots":2,"stack":3,"rerolls":1},"weekly":{"slots":3,"pack":1,"xp":250,"allDoneSeals":{"r":1}},"achievement":{"bronze":{"seals":{"u":1},"xp":100},"silver":{"seals":{"r":1},"xp":250},"gold":{"seals":{"m":1},"xp":500}},"story":{"firstWinPacks":1,"starPacks":1,"starCoins":100,"firstWinXp":150,"replayPacksPerDay":3,"eraClearSeals":{"m":1}},"planeswalk":{"actBossPacks":1,"finalBossPacks":2,"packsPerDay":5},"friends":{"countPerDay":3,"winsCount":false},"mastery":{"xpPerLevel":1000,"cycle":[{"coins":300},{"packs":1},{"cosmetic":true},{"seals":{"r":1}}]},"winsPay":false,"concedeMinTurns":5,"mythicDuplicateShards":4,"meltRareToMythic":3,"sealOverrides":{}}$config$::jsonb)
  on conflict (id) do nothing;
