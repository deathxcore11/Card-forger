-- Run in a single transaction. Synthetic accounts and all changes roll back.
begin;
do $$
declare
 a uuid:=gen_random_uuid(); b uuid:=gen_random_uuid(); c uuid:=gen_random_uuid(); n integer;
begin
 insert into auth.users(id,email,is_anonymous) values
 (a,'isolation-a-'||a||'@example.invalid',false),
 (b,'isolation-b-'||b||'@example.invalid',false),
 (c,'isolation-c-'||c||'@example.invalid',false);
 insert into public.workspaces(user_id,data) values(a,'{"fixture":"A"}'),(b,'{"fixture":"B"}');
 perform set_config('role','authenticated',true);
 perform set_config('request.jwt.claim.sub',a::text,true);
 select count(*) into n from public.workspaces;
 if n<>1 then raise exception 'RLS read failure'; end if;
 update public.workspaces set data='{}' where user_id=b;
 get diagnostics n=row_count;
 if n<>0 then raise exception 'RLS cross-account update failure'; end if;
 delete from public.workspaces where user_id=b;
 get diagnostics n=row_count;
 if n<>0 then raise exception 'RLS cross-account delete failure'; end if;
 begin
  insert into public.workspaces(user_id,data) values(c,'{}');
  raise exception 'RLS cross-account insert failure';
 exception when insufficient_privilege then null; end;
 begin
  update public.workspaces set user_id=c where user_id=a;
  raise exception 'RLS ownership transfer failure';
 exception when insufficient_privilege then null; end;
 perform set_config('request.jwt.claim.sub',b::text,true);
 select count(*) into n from public.workspaces where user_id=b and data->>'fixture'='B';
 if n<>1 then raise exception 'Account B changed'; end if;
 select count(*) into n from public.workspaces where user_id=a;
 if n<>0 then raise exception 'B can read A'; end if;
end$$;
select 'PASS: account reads isolated; cross-account writes rejected; synthetic fixtures rolled back' as result;
rollback;
