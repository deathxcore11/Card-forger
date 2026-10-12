-- Cardforge accounts, milestone 1: profiles and private cloud workspaces.
-- Every table has row-level security; a signed-in user can only read or write
-- their own rows. Nothing here is readable without signing in.

-- Profiles -------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text unique check (username ~ '^[A-Za-z0-9_]{3,30}$'),
  display_name text check (char_length(display_name) <= 60),
  avatar_url text check (char_length(avatar_url) <= 500),
  bio text check (char_length(bio) <= 500),
  favorite_formats text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "Profiles: read own" on public.profiles;
create policy "Profiles: read own" on public.profiles
  for select to authenticated using ((select auth.uid()) = id);
drop policy if exists "Profiles: insert own" on public.profiles;
create policy "Profiles: insert own" on public.profiles
  for insert to authenticated with check ((select auth.uid()) = id);
drop policy if exists "Profiles: update own" on public.profiles;
create policy "Profiles: update own" on public.profiles
  for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

-- Create a profile for every new account, using the name/photo from Google when present.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    left(coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)), 60),
    left(new.raw_user_meta_data ->> 'avatar_url', 500)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Workspaces -------------------------------------------------------------------
-- One private row per user holding the whole Cardforge workspace (collection,
-- decks, wishlist, notes, settings). `revision` goes up by one on every save;
-- the app only writes when the revision it last saw is still current, so two
-- devices can never silently overwrite each other.
create table if not exists public.workspaces (
  user_id uuid primary key references auth.users (id) on delete cascade,
  data jsonb not null,
  revision bigint not null default 1 check (revision > 0),
  device text check (char_length(device) <= 120),
  updated_at timestamptz not null default now(),
  constraint workspace_size check (pg_column_size(data) < 20000000)
);

alter table public.workspaces enable row level security;

drop policy if exists "Workspaces: read own" on public.workspaces;
create policy "Workspaces: read own" on public.workspaces
  for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "Workspaces: insert own" on public.workspaces;
create policy "Workspaces: insert own" on public.workspaces
  for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists "Workspaces: update own" on public.workspaces;
create policy "Workspaces: update own" on public.workspaces
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists "Workspaces: delete own" on public.workspaces;
create policy "Workspaces: delete own" on public.workspaces
  for delete to authenticated using ((select auth.uid()) = user_id);

-- Keep updated_at honest regardless of what the client sends.
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists workspaces_touch on public.workspaces;
create trigger workspaces_touch before update on public.workspaces
  for each row execute procedure public.touch_updated_at();
drop trigger if exists profiles_touch on public.profiles;
create trigger profiles_touch before update on public.profiles
  for each row execute procedure public.touch_updated_at();

-- No access at all for signed-out visitors.
revoke all on public.workspaces from anon;
revoke all on public.profiles from anon;
