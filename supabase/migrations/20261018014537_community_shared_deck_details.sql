-- Preserve deck sections for independent copies; share only public reference prices.
create or replace function community_private.perform(action text,payload jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
 me uuid:=auth.uid(); target uuid; lo uuid; hi uuid; rel community_private.friendships%rowtype;
 result jsonb; found jsonb; q text; lookup_count integer; snapshot jsonb; cards jsonb; selected_item_key text;
begin
 if me is null or not exists(select 1 from auth.users where id=me and not coalesce(is_anonymous,false)) then raise exception 'Sign in first.' using errcode='42501'; end if;
 if pg_column_size(payload)>2200000 then raise exception 'This selection is too large.'; end if;
 if action='lookup' then
  q:=trim(payload->>'query');
  if coalesce(length(q),0) not between 3 and 254 then raise exception 'Enter an exact username or email.'; end if;
  insert into community_private.lookup_windows(user_id) values(me)
   on conflict(user_id) do update set
    requests=case when community_private.lookup_windows.started_at<now()-interval '1 minute' then 1 else community_private.lookup_windows.requests+1 end,
    started_at=case when community_private.lookup_windows.started_at<now()-interval '1 minute' then now() else community_private.lookup_windows.started_at end
   returning requests into lookup_count;
  if lookup_count>30 then return jsonb_build_object('error','Please wait a minute before searching again.'); end if;
  select p.id into target from public.profiles p join auth.users u on u.id=p.id
   where p.id<>me and (lower(p.username)=lower(q) or (position('@' in q)>0 and lower(u.email)=lower(q)))
   and not exists(select 1 from community_private.blocks b where (b.owner_id=me and b.target_id=p.id) or (b.owner_id=p.id and b.target_id=me)) limit 1;
  if target is null then return jsonb_build_object('person',null); end if;
  select jsonb_build_object('id',p.id,'username',p.username,'display_name',p.display_name,'avatar',a.avatar,'avatar_url',p.avatar_url,
    'relationship',coalesce(f.status,'none'),'incoming',coalesce(f.sender<>me,false)) into found
   from public.profiles p left join community_private.profile_art a on a.user_id=p.id
   left join community_private.friendships f on f.low_id=least(me,p.id) and f.high_id=greatest(me,p.id) where p.id=target;
  return jsonb_build_object('person',found);
 end if;
 if action='overview' then
  select jsonb_build_object('avatar',a.avatar,'header',a.header) into found from community_private.profile_art a where a.user_id=me;
  select jsonb_build_object('art',coalesce(found,'{}'::jsonb),'people',coalesce((
   select jsonb_agg(jsonb_build_object('id',p.id,'username',p.username,'display_name',p.display_name,'avatar',a.avatar,'avatar_url',p.avatar_url,'relationship',f.status,'incoming',f.sender<>me) order by p.display_name,p.id)
   from community_private.friendships f join public.profiles p on p.id=case when f.low_id=me then f.high_id else f.low_id end
   left join community_private.profile_art a on a.user_id=p.id where me in(f.low_id,f.high_id)
  ),'[]'::jsonb),'items',coalesce((select jsonb_agg(s.item order by s.updated_at desc) from community_private.showcase s where s.owner_id=me),'[]'::jsonb),
   'blocked',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'username',p.username,'display_name',p.display_name)) from community_private.blocks b join public.profiles p on p.id=b.target_id where b.owner_id=me),'[]'::jsonb)) into result;
  return result;
 end if;
 if action='save_art' then
  insert into community_private.profile_art(user_id,avatar,header) values(me,community_private.safe_art(payload->'avatar'),community_private.safe_art(payload->'header'))
   on conflict(user_id) do update set avatar=excluded.avatar,header=excluded.header,updated_at=now();
  return jsonb_build_object('saved',true);
 end if;
 if action='share' then
  snapshot:=payload->'item'; selected_item_key:=snapshot->>'key';
  if coalesce(length(selected_item_key),0) not between 1 and 150 or coalesce(snapshot->>'kind','') not in('binder','deck') or coalesce(snapshot->>'game','') not in('mtg','ptcg','ygo')
   or coalesce(jsonb_typeof(snapshot->'cards'),'')<>'array' or coalesce(jsonb_array_length(snapshot->'cards'),0)>5000 then raise exception 'Choose a valid binder or deck.'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('id',left(c->>'id',100),'name',left(c->>'name',200),'qty',greatest(1,least(999,coalesce((c->>'qty')::integer,1))),
   'image',case when c->>'image' ~ '^(https://|img/)' then left(c->>'image',1500) else '' end,
   'set',left(c->>'set',150),'number',left(c->>'number',60),'version',left(c->>'version',120),'zone',case when c->>'zone' in ('main','extra','side') then c->>'zone' else 'main' end,'referenceUSD',case when jsonb_typeof(c->'referenceUSD')='number' and (c->>'referenceUSD')::numeric>=0 then least(1000000,(c->>'referenceUSD')::numeric) else null end)), '[]'::jsonb) into cards from jsonb_array_elements(snapshot->'cards') c;
  snapshot:=jsonb_build_object('key',selected_item_key,'kind',snapshot->>'kind','game',snapshot->>'game','title',left(snapshot->>'title',100),'format',left(snapshot->>'format',60),'commander',left(snapshot->>'commander',200),'deckSchema',case when snapshot->>'deckSchema'='1' then 1 else 0 end,'cards',cards);
  insert into community_private.showcase(owner_id,item_key,item) values(me,selected_item_key,snapshot)
   on conflict(owner_id,item_key) do update set item=excluded.item,updated_at=now();
  return jsonb_build_object('saved',true);
 end if;
 if action='unshare' then
  delete from community_private.showcase where owner_id=me and item_key=payload->>'key';return jsonb_build_object('saved',true);
 end if;
 target:=(payload->>'target')::uuid;
 if target is null or target=me then raise exception 'Choose another account.'; end if;
 lo:=least(me,target);hi:=greatest(me,target);
 perform pg_advisory_xact_lock(hashtextextended(lo::text||hi::text,0));
 if action='block' then
  insert into community_private.blocks(owner_id,target_id) values(me,target) on conflict do nothing;
  delete from community_private.friendships where low_id=lo and high_id=hi;
  return jsonb_build_object('saved',true);
 end if;
 if action='unblock' then
  delete from community_private.blocks where owner_id=me and target_id=target;return jsonb_build_object('saved',true);
 end if;
 if exists(select 1 from community_private.blocks where (owner_id=me and target_id=target) or (owner_id=target and target_id=me)) then raise exception 'This profile is unavailable.' using errcode='42501'; end if;
 select * into rel from community_private.friendships where low_id=lo and high_id=hi;
 if action='request' then
  if not exists(select 1 from public.profiles where id=target) then raise exception 'This profile is unavailable.';end if;
  insert into community_private.friendships(low_id,high_id,sender,status) values(lo,hi,me,'pending') on conflict do nothing;
  return jsonb_build_object('saved',true);
 elsif action='accept' then
  if rel.status<>'pending' or rel.sender=me or rel.sender is null then raise exception 'No incoming request to accept.' using errcode='42501';end if;
  update community_private.friendships set status='accepted' where low_id=lo and high_id=hi;
  return jsonb_build_object('saved',true);
 elsif action in('remove','decline') then
  delete from community_private.friendships where low_id=lo and high_id=hi;return jsonb_build_object('saved',true);
 elsif action='profile' then
  if rel.status is distinct from 'accepted' then raise exception 'Accept a friend request to view this profile.' using errcode='42501';end if;
  select jsonb_build_object('id',p.id,'username',p.username,'display_name',p.display_name,'bio',p.bio,'avatar_url',p.avatar_url,'avatar',a.avatar,'header',a.header,
   'items',coalesce((select jsonb_agg(s.item order by s.updated_at desc) from community_private.showcase s where s.owner_id=p.id),'[]'::jsonb)) into result
   from public.profiles p left join community_private.profile_art a on a.user_id=p.id where p.id=target;
  return result;
 end if;
 raise exception 'Unknown community action.';
end $$;
