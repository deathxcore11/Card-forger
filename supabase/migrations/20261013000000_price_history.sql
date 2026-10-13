-- CardStashy shared price history.
-- One row per card printing, finish, source, currency and day. Recorded once a day by the
-- Cloudflare Worker (service key) for every card someone tracks, so charts grow toward
-- 6 months and a year without anyone opening the card. Market prices only: no user data.

create table if not exists public.price_points (
  game text not null check (game in ('mtg', 'ygo', 'ptcg')),
  card_id text not null check (char_length(card_id) between 1 and 80),
  finish text not null default 'nonfoil' check (char_length(finish) <= 40),
  source text not null check (char_length(source) <= 60),
  currency text not null default 'USD' check (currency in ('USD', 'EUR')),
  day date not null,
  price numeric(12, 2) not null check (price >= 0),
  primary key (game, card_id, finish, source, currency, day)
);
create index if not exists price_points_lookup on public.price_points (game, card_id, finish, day desc);

alter table public.price_points enable row level security;
drop policy if exists "Price points: public read" on public.price_points;
create policy "Price points: public read" on public.price_points for select to anon, authenticated using (true);
revoke all on public.price_points from anon, authenticated;
grant select on public.price_points to anon, authenticated;

-- Cards to record. Added by the Worker when someone views or owns a card; nobody else can read it.
create table if not exists public.price_watch (
  game text not null check (game in ('mtg', 'ygo', 'ptcg')),
  card_id text not null check (char_length(card_id) between 1 and 80),
  added date not null default current_date,
  last_seen date not null default current_date,
  primary key (game, card_id)
);
create index if not exists price_watch_recent on public.price_watch (game, last_seen desc);
alter table public.price_watch enable row level security;
revoke all on public.price_watch from anon, authenticated;

-- Keep a little over a year (charts show up to 1 year).
create or replace function public.prune_price_points()
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.price_points where day < current_date - 400;
  delete from public.price_watch where last_seen < current_date - 120;
$$;
revoke execute on function public.prune_price_points() from public, anon, authenticated;
