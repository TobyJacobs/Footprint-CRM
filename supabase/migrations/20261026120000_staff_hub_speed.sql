-- Faster Staff hub (15 October 2026).
--
-- Plain-English summary: the Staff hub showed six months of figures by asking
-- the database seven times. This returns every month it needs in one go
-- (same figures as before, from team_month_stats). Runs as the person asking,
-- so the usual rules apply: sales staff only see their own figures.

create function public.team_stats_history(p_ranges jsonb)
returns jsonb
language sql stable security invoker set search_path = ''
as $$
  select coalesce(jsonb_object_agg(r ->> 'key', public.team_month_stats((r ->> 'from')::date, (r ->> 'to')::date)), '{}'::jsonb)
    from jsonb_array_elements(p_ranges) r;
$$;

revoke execute on function public.team_stats_history(jsonb) from anon, public;
grant execute on function public.team_stats_history(jsonb) to authenticated;
