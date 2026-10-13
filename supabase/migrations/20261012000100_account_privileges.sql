-- Remove inherited default privileges that could bypass row-level security.
revoke all on public.profiles, public.workspaces from authenticated;
grant select, insert, update on public.profiles to authenticated;
grant select, insert, update, delete on public.workspaces to authenticated;
