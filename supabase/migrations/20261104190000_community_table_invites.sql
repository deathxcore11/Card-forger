-- Game Night shared table (Randall, 4 Nov 2026): a host sends the table link to an accepted friend.
-- The link code is the Realtime channel name (table-share.js); this only delivers it. Friends only,
-- blocks respected either way, one open invite per pair, gone after 3 hours or when answered.
create table if not exists community_private.table_invites (
 from_id uuid not null references auth.users(id) on delete cascade,
 to_id uuid not null references auth.users(id) on delete cascade,
 code text not null check (code ~ '^[A-Za-z0-9_-]{43}$'),
 at timestamptz not null default now(),
 primary key (from_id, to_id)
);
alter table community_private.table_invites enable row level security;
revoke all on community_private.table_invites from public, anon, authenticated;

create or replace function community_private.table_invite_action(action text, payload jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare me uuid := auth.uid(); other uuid; c text;
begin
 if me is null or not exists(select 1 from auth.users where id=me and not coalesce(is_anonymous,false)) then raise exception 'Sign in first.' using errcode='42501'; end if;
 delete from community_private.table_invites where at < now() - interval '3 hours';
 if action='send' then
  other := case when coalesce(payload->>'to','') ~ '^[0-9a-f-]{36}$' then (payload->>'to')::uuid end;
  c := coalesce(payload->>'code','');
  if other is null or other=me or c !~ '^[A-Za-z0-9_-]{43}$' then raise exception 'Choose a friend.'; end if;
  if not exists(select 1 from community_private.friendships f where f.status='accepted' and f.low_id=least(me,other) and f.high_id=greatest(me,other))
   or exists(select 1 from community_private.blocks b where (b.owner_id=me and b.target_id=other) or (b.owner_id=other and b.target_id=me))
  then raise exception 'You can only invite accepted friends.'; end if;
  insert into community_private.table_invites(from_id,to_id,code,at) values(me,other,c,now())
   on conflict(from_id,to_id) do update set code=excluded.code, at=now();
  return jsonb_build_object('sent',true);
 end if;
 if action='mine' then
  return coalesce((select jsonb_agg(jsonb_build_object('from',i.from_id,'name',coalesce(p.display_name,p.username,'A friend'),'code',i.code,'at',i.at) order by i.at desc)
   from community_private.table_invites i join public.profiles p on p.id=i.from_id
   where i.to_id=me and not exists(select 1 from community_private.blocks b where (b.owner_id=me and b.target_id=i.from_id) or (b.owner_id=i.from_id and b.target_id=me))),'[]'::jsonb);
 end if;
 if action='clear' then
  other := case when coalesce(payload->>'from','') ~ '^[0-9a-f-]{36}$' then (payload->>'from')::uuid end;
  delete from community_private.table_invites where to_id=me and from_id=other;
  return jsonb_build_object('cleared',true);
 end if;
 raise exception 'Unknown table invite action.';
end $$;
revoke all on function community_private.table_invite_action(text,jsonb) from public, anon, authenticated;
grant execute on function community_private.table_invite_action(text,jsonb) to authenticated;
create or replace function public.community_table_invite(action text, payload jsonb default '{}'::jsonb)
returns jsonb language sql security invoker set search_path='' as $$ select community_private.table_invite_action(action,payload); $$;
revoke all on function public.community_table_invite(text,jsonb) from public, anon;
grant execute on function public.community_table_invite(text,jsonb) to authenticated;
