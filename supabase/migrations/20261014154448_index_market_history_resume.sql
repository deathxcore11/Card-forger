create index if not exists market_series_resume_idx on public.market_series (game, source, updated_at) include (card_id, finish);
