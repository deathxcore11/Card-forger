-- Rich presence (Randall, 4 Nov 2026): accepted friends see what you are doing in Play, e.g.
-- "Story · Act 12 · The Kami Are Coming · turn 5". One row per player, written by the app's beats
-- (play-presence.js). Friends only, blocks respected, and a player can switch it off ("hide").
-- A row older than 2 minutes reads as offline, showing only when that player was last seen.
-- The label is short display text the app builds from its own state; friends' apps escape it.
-- Short lines on purpose: Randall pastes this from his phone, which drops the ends of long lines.
create table if not exists
  community_private.presence (
  user_id uuid primary key
    references auth.users(id)
    on delete cascade,
  share boolean not null
    default true,
  mode text not null
    default 'app',
  label text not null
    default '',
  turn integer,
  at timestamptz not null
    default now()
);
alter table community_private.presence
  enable row level security;
revoke all
  on community_private.presence
  from public, anon, authenticated;

create or replace function
  community_private.presence_action(
  action text,
  payload jsonb default '{}'::jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  live boolean;
  m text;
  l text;
  t integer;
  r jsonb;
begin
  if me is null then
    raise exception 'Sign in first.';
  end if;

  if action = 'beat' then
    m := coalesce(payload->>'mode', 'app');
    if m not in ('app', 'lobby',
      'story', 'quick', 'practice',
      'friend', 'packs', 'merchant',
      'decks', 'trunk', 'deeds',
      'planeswalk') then
      m := 'app';
    end if;
    l := coalesce(payload->>'label', '');
    l := regexp_replace(l,
      '[[:cntrl:]<>]', '', 'g');
    l := left(l, 80);
    t := null;
    if coalesce(payload->>'turn', '')
      ~ '^[0-9]{1,3}$' then
      t := (payload->>'turn')::integer;
    end if;
    insert into
      community_private.presence
      (user_id, mode, label, turn, at)
    values (me, m, l, t, now())
    on conflict (user_id) do update
      set mode = excluded.mode,
        label = excluded.label,
        turn = excluded.turn,
        at = now()
      where community_private
        .presence.share;
    return '{"saved":true}'::jsonb;
  end if;

  if action = 'hide' then
    insert into
      community_private.presence
      (user_id, share)
    values (me, false)
    on conflict (user_id) do update
      set share = false,
        mode = 'app',
        label = '',
        turn = null;
    return '{"saved":true}'::jsonb;
  end if;

  if action = 'show' then
    insert into
      community_private.presence
      (user_id, share)
    values (me, true)
    on conflict (user_id) do update
      set share = true;
    return '{"saved":true}'::jsonb;
  end if;

  if action = 'mine' then
    select p.share into live
      from community_private.presence p
      where p.user_id = me;
    return jsonb_build_object(
      'share', coalesce(live, true));
  end if;

  if action = 'friends' then
    select coalesce(jsonb_object_agg(
      p.user_id, jsonb_build_object(
        'online', p.on_now,
        'mode', p.mode_now,
        'label', p.label_now,
        'turn', p.turn_now,
        'at', p.at)), '{}'::jsonb)
    into r
    from (
      select x.user_id, x.at,
        x.at > now() - interval
          '2 minutes' as on_now,
        case when x.at > now()
          - interval '2 minutes'
          then x.mode end as mode_now,
        case when x.at > now()
          - interval '2 minutes'
          then x.label end as label_now,
        case when x.at > now()
          - interval '2 minutes'
          then x.turn end as turn_now
      from community_private
        .friendships f
      join community_private
        .presence x
        on x.user_id = case
          when f.low_id = me
          then f.high_id
          else f.low_id end
      where me in (f.low_id, f.high_id)
        and f.status = 'accepted'
        and x.share
        and not exists (
          select 1 from community_private
            .blocks b
          where (b.owner_id = me
              and b.target_id = x.user_id)
            or (b.owner_id = x.user_id
              and b.target_id = me))
    ) p;
    return r;
  end if;

  raise exception 'Unknown action.';
end
$$;

revoke all on function
  community_private.presence_action
  (text, jsonb)
  from public, anon, authenticated;
grant execute on function
  community_private.presence_action
  (text, jsonb)
  to authenticated;

create or replace function
  public.community_presence(
  action text,
  payload jsonb default '{}'::jsonb)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select community_private
    .presence_action(action, payload);
$$;

revoke all on function
  public.community_presence
  (text, jsonb)
  from public, anon;
grant execute on function
  public.community_presence
  (text, jsonb)
  to authenticated;
