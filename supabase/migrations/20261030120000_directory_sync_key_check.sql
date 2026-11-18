-- Daily staff sync: check the key first (19 October 2026).
--
-- Plain-English summary:
-- * The daily Microsoft 365 staff sync link used to fetch the whole staff list
--   from Microsoft before the database checked its secret key. Nothing could be
--   saved without the key, but anyone could make it call Microsoft repeatedly.
-- * This function lets the link check the key on its own, first, so a wrong
--   key is turned away before Microsoft is contacted. It only answers yes or
--   no; the key itself is never stored, only its fingerprint (as before).

create function public.check_directory_sync_key(p_key text)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select p_key is not null
     and length(p_key) >= 32
     and encode(sha256(convert_to(p_key, 'UTF8')), 'hex') is not distinct from
         (select cron_key_hash from public.directory_sync_settings where id)
     and (select cron_key_hash from public.directory_sync_settings where id) is not null;
$$;

revoke execute on function public.check_directory_sync_key(text) from public;
grant execute on function public.check_directory_sync_key(text) to anon, authenticated;
