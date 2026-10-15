-- Account deletion (Google Play requires it in the app and on the web).
-- A signed-in user can delete their own account: their synced collection/decks (workspaces) and
-- profile are removed with it (both also cascade from auth.users). Shared price history holds no
-- user data. Run once in Supabase → SQL Editor.
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Not signed in';
  end if;
  delete from public.workspaces where user_id = uid;
  delete from public.profiles where id = uid;
  delete from auth.users where id = uid;
end;
$$;
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
