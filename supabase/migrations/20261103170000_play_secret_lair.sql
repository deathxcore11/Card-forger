-- Secret Lair in Play (play-secret-lair.js): the art styles a player has unlocked, one row per Secret Lair
-- printing, and which one each card shows. A style changes the art only, never counts or rules.
-- Grants are once per ref: a play.ledger row ('style' kind) guards every unlock, like play_bump.
-- Server only (service key); the app reads them through /api/progress.
create table if not exists play.styles (
  user_id uuid not null references auth.users (id) on delete cascade,
  print_id text not null check (print_id ~ '^[0-9a-f-]{36}$'),
  oracle_id text not null check (length(oracle_id) between 1 and 64),
  name text not null default '' check (length(name) <= 200),
  image text not null default '' check (length(image) <= 300),
  chosen boolean not null default false,
  source text not null default '' check (length(source) <= 120),
  at timestamptz not null default now(),
  primary key (user_id, print_id)
);
create index if not exists play_styles_card on play.styles (user_id, oracle_id);
alter table play.styles enable row level security;
drop policy if exists "Play styles: read own" on play.styles;
create policy "Play styles: read own" on play.styles for select to authenticated using ((select auth.uid()) = user_id);
grant select on play.styles to authenticated;

-- The player's styles, and the Secret Lair bundles bought in the last five weeks (sl:<week> refs).
create or replace function public.play_styles(p_user uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'styles', coalesce((select jsonb_agg(jsonb_build_object('o', s.oracle_id, 'id', s.print_id, 'n', s.name, 'i', s.image, 'on', s.chosen, 'src', s.source) order by s.at desc)
      from play.styles s where s.user_id = p_user), '[]'::jsonb),
    'bundles', coalesce((select jsonb_agg(l.ref) from play.ledger l
      where l.user_id = p_user and l.ref like 'sl:%' and l.ref not like 'sl:%:%' and l.at > now() - interval '35 days'), '[]'::jsonb));
$$;

-- Unlocks styles once per ref. p_styles: [{o, id, n, i}]. Returns {duplicate, added}.
create or replace function public.play_add_styles(p_user uuid, p_ref text, p_styles jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare e jsonb; n int := 0;
begin
  insert into play.ledger (user_id, ref, kind, delta) values (p_user, p_ref, 'style', jsonb_build_object('styles', p_styles))
    on conflict (user_id, ref) do nothing;
  if not found then return jsonb_build_object('duplicate', true, 'added', 0); end if;
  for e in select * from jsonb_array_elements(coalesce(p_styles, '[]'::jsonb)) loop
    if coalesce(e->>'id', '') ~ '^[0-9a-f-]{36}$' and length(coalesce(e->>'o', '')) between 1 and 64 then
      insert into play.styles (user_id, print_id, oracle_id, name, image, source)
        values (p_user, e->>'id', e->>'o', left(coalesce(e->>'n', ''), 200), left(coalesce(e->>'i', ''), 300), left(p_ref, 120))
        on conflict (user_id, print_id) do nothing;
      if found then n := n + 1; end if;
    end if;
  end loop;
  return jsonb_build_object('duplicate', false, 'added', n);
end;
$$;

-- Shows one unlocked style on a card (p_print), or the card's own art again (p_print null).
create or replace function public.play_pick_style(p_user uuid, p_oracle text, p_print text)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  if p_print is not null and not exists (select 1 from play.styles where user_id = p_user and oracle_id = p_oracle and print_id = p_print) then
    raise exception 'style_locked';
  end if;
  update play.styles set chosen = coalesce(print_id = p_print, false) where user_id = p_user and oracle_id = p_oracle;
  return public.play_styles(p_user);
end;
$$;

revoke all on function public.play_styles(uuid) from public, anon, authenticated;
revoke all on function public.play_add_styles(uuid, text, jsonb) from public, anon, authenticated;
revoke all on function public.play_pick_style(uuid, text, text) from public, anon, authenticated;
grant execute on function public.play_styles(uuid) to service_role;
grant execute on function public.play_add_styles(uuid, text, jsonb) to service_role;
grant execute on function public.play_pick_style(uuid, text, text) to service_role;
