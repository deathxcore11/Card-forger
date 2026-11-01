-- Story mode progress (story-mode-acts.md, Acts 1 to 3). Story needs no new table: every clear and
-- star is a row in play.ledger with a unique story:* ref, written by the server through play.apply.
-- This read gives the server one player's story refs. Server only (service key).
create or replace function public.play_story_refs(p_user uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(l.ref order by l.id), '[]'::jsonb)
  from play.ledger l where l.user_id = p_user and l.ref like 'story:%';
$$;
revoke all on function public.play_story_refs(uuid) from public, anon, authenticated;
grant execute on function public.play_story_refs(uuid) to service_role;
