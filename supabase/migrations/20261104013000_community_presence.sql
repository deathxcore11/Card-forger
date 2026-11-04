-- Rich presence (Randall, 4 Nov 2026): accepted friends see what you are doing in Play, e.g.
-- "Story · Act 12 · The Kami Are Coming · turn 5". One row per player, written by the app's beats
-- (play-presence.js). Friends only, blocks respected, and a player can switch it off ("hide").
-- A row older than 2 minutes reads as offline, showing only when that player was last seen.
-- The label is short display text the app builds from its own state; friends' apps escape it.
create table if not exists community_private.presence (
 user_id uuid primary key references auth.users(id) on delete cascade,
 share boolean not null default true,
 mode text not null default 'app' check (mode in ('app','lobby','story','quick','practice','friend','packs','merchant','decks','trunk','deeds','planeswalk')),
 label text not null default '' check (length(label) <= 80),
 turn integer check (turn between 0 and 999),
 at timestamptz not null default now()
);
alter table community_private.presence enable row level security;
revoke all on community_private.presence from public, anon, authenticated;

create or replace function community_private.presence_action(action text, payload jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare me uuid := auth.uid(); m text; l text; t integer; result jsonb;
begin
 if me is null or not exists(select 1 from auth.users where id=me and not coalesce(is_anonymous,false)) then raise exception 'Sign in first.' using errcode='42501'; end if;
 if action='beat' then
  m := coalesce(payload->>'mode','app');
  if m not in ('app','lobby','story','quick','practice','friend','packs','merchant','decks','trunk','deeds','planeswalk') then m := 'app'; end if;
  l := left(regexp_replace(coalesce(payload->>'label',''), '[[:cntrl:]<>]', '', 'g'), 80);
  t := case when coalesce(payload->>'turn','') ~ '^[0-9]{1,3}$' then (payload->>'turn')::integer else null end;
  -- A player who switched presence off stays off until they switch it back on (action 'show').
  insert into community_private.presence(user_id,mode,label,turn,at) values(me,m,l,t,now())
   on conflict(user_id) do update set mode=excluded.mode,label=excluded.label,turn=excluded.turn,at=now()
   where community_private.presence.share;
  return jsonb_build_object('saved',true);
 end if;
 if action='hide' then
  insert into community_private.presence(user_id,share,mode,label,turn,at) values(me,false,'app','',null,now())
   on conflict(user_id) do update set share=false,mode='app',label='',turn=null;
  return jsonb_build_object('saved',true);
 end if;
 if action='show' then
  insert into community_private.presence(user_id,share) values(me,true) on conflict(user_id) do update set share=true;
  return jsonb_build_object('saved',true);
 end if;
 if action='mine' then
  return jsonb_build_object('share',coalesce((select share from community_private.presence where user_id=me),true));
 end if;
 if action='friends' then
  -- Accepted friends who share, never anyone blocked either way: {<id>: {online, mode, label, turn, at}}.
  select coalesce(jsonb_object_agg(p.user_id, jsonb_build_object('online', p.at > now() - interval '2 minutes',
    'mode', case when p.at > now() - interval '2 minutes' then p.mode end, 'label', case when p.at > now() - interval '2 minutes' then p.label end,
    'turn', case when p.at > now() - interval '2 minutes' then p.turn end, 'at', p.at)), '{}'::jsonb) into result
   from community_private.friendships f
   join community_private.presence p on p.user_id = case when f.low_id=me then f.high_id else f.low_id end
   where me in (f.low_id,f.high_id) and f.status='accepted' and p.share
    and not exists(select 1 from community_private.blocks b where (b.owner_id=me and b.target_id=p.user_id) or (b.owner_id=p.user_id and b.target_id=me));
  return result;
 end if;
 raise exception 'Unknown presence action.';
end $$;
revoke all on function community_private.presence_action(text,jsonb) from public, anon, authenticated;
grant execute on function community_private.presence_action(text,jsonb) to authenticated;

create or replace function public.community_presence(action text, payload jsonb default '{}'::jsonb)
returns jsonb language sql security invoker set search_path='' as $$ select community_private.presence_action(action,payload); $$;
revoke all on function public.community_presence(text,jsonb) from public, anon;
grant execute on function public.community_presence(text,jsonb) to authenticated;
