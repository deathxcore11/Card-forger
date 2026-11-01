-- Play Trunk "Recently added" sort (Randall 2026-11-01 21:37Z): when a card last gained a copy
-- (normal or holo). play_state now sends "a" per card. Safe to re-run.
alter table play.cards add column if not exists last_at timestamptz;
update play.cards set last_at = first_at where last_at is null;
alter table play.cards alter column last_at set default now();

create or replace function play.cards_touch() returns trigger language plpgsql set search_path = '' as $$
begin
  if new.count > old.count or new.holo > old.holo then new.last_at := now(); end if;
  return new;
end;
$$;
drop trigger if exists play_cards_touch on play.cards;
create trigger play_cards_touch before update on play.cards for each row execute function play.cards_touch();

create or replace function public.play_state(p_user uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'config', (select data from play.config where id = 1),
    'wallet', (select to_jsonb(w) - 'user_id' from play.wallet w where w.user_id = p_user),
    'packs', coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'set', p.set_code, 'source', p.source, 'at', p.granted_at) order by p.id)
                        from play.packs p where p.user_id = p_user and p.opened_at is null), '[]'::jsonb),
    'cards', coalesce((select jsonb_agg(jsonb_build_object('o', c.oracle_id, 'n', c.name, 'r', c.rarity, 'c', c.count, 'h', c.holo, 's', c.sets, 'p', c.print, 'a', coalesce(c.last_at, c.first_at)))
                        from play.cards c where c.user_id = p_user and c.count > 0), '[]'::jsonb),
    'decks', coalesce((select jsonb_agg(jsonb_build_object('id', d.id, 'name', d.name, 'format', d.format, 'cards', d.cards, 'at', d.updated_at) order by d.updated_at desc)
                        from play.decks d where d.user_id = p_user), '[]'::jsonb)
  );
$$;
revoke all on function public.play_state(uuid) from public, anon, authenticated;
grant execute on function public.play_state(uuid) to service_role;
