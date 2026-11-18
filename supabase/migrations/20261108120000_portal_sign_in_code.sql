-- Customer portal: sign in with a 6-digit code too (27 October 2026).
--
-- Plain-English summary:
-- * The sign-in email now has a 6-digit code as well as the button, so people
--   can read the email on their phone and type the code on their laptop.
-- * The code and the button are the same sign-in: using either one uses both.
--   It works once and for 30 minutes, like the button.
-- * After 5 wrong codes for an email, all its current codes stop working (ask
--   for a new email), so codes can't be guessed.
-- * Only a fingerprint of each code is stored, mixed with its link's
--   fingerprint, never the code itself.

alter table public.portal_links
  add column code_hash text,
  add column failed_attempts integer not null default 0;

-- A new signed-in session for this email; returns its token.
create function public._portal_new_session(p_email text)
returns text
language plpgsql security definer set search_path = ''
as $$
declare
  v_session text := replace(gen_random_uuid()::text || gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
begin
  delete from public.portal_sessions where expires_at < now();
  insert into public.portal_sessions (email, token_hash, expires_at)
  values (p_email, public._portal_hash(v_session), now() + interval '14 days');
  return v_session;
end;
$$;
revoke execute on function public._portal_new_session(text) from public, anon, authenticated;

-- Replaces the first version: FootprintOS now also sends the code's
-- fingerprint (sha256 of "<link fingerprint>:<code>").
drop function public.portal_request_link(text, text, text);
create function public.portal_request_link(p_key text, p_email text, p_token_hash text, p_code_hash text)
returns boolean
language plpgsql security definer set search_path = ''
as $$
declare
  v_email text := lower(trim(coalesce(p_email, '')));
  v_hash text := (select link_key_hash from public.portal_settings where id);
begin
  if v_hash is null or p_key is null or length(p_key) < 32 or public._portal_hash(p_key) <> v_hash then
    raise exception 'Not allowed';
  end if;
  if p_token_hash is null or p_token_hash !~ '^[0-9a-f]{64}$' or p_code_hash is null or p_code_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'Bad token';
  end if;
  if v_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' or not exists (select 1 from public._portal_customer_ids(v_email)) then
    return false;
  end if;
  -- At most 5 links per email per hour.
  if (select count(*) from public.portal_links
       where email = v_email and created_at > now() - interval '1 hour') >= 5 then
    return false;
  end if;
  delete from public.portal_links where expires_at < now() - interval '1 day';
  insert into public.portal_links (email, token_hash, code_hash, expires_at)
  values (v_email, p_token_hash, p_code_hash, now() + interval '30 minutes');
  return true;
end;
$$;

-- The button in the email (replaces the first version, using the shared
-- session maker). Refuses a link whose code has been guessed at too often.
create or replace function public.portal_sign_in(p_link text)
returns text
language plpgsql security definer set search_path = ''
as $$
declare
  v_email text;
begin
  if p_link is null or length(p_link) < 64 then
    return null;
  end if;
  update public.portal_links
     set used_at = now()
   where token_hash = public._portal_hash(p_link)
     and used_at is null
     and failed_attempts < 5
     and expires_at > now()
  returning email into v_email;
  if v_email is null or not exists (select 1 from public._portal_customer_ids(v_email)) then
    return null;
  end if;
  return public._portal_new_session(v_email);
end;
$$;

-- The 6-digit code typed on the "check your inbox" screen. Returns a session
-- token, or null (and counts a wrong guess against that email's codes).
create function public.portal_sign_in_code(p_email text, p_code text)
returns text
language plpgsql security definer set search_path = ''
as $$
declare
  v_email text := lower(trim(coalesce(p_email, '')));
  v_id uuid;
begin
  if p_code is null or p_code !~ '^[0-9]{6}$' then
    return null;
  end if;
  select l.id into v_id
    from public.portal_links l
   where l.email = v_email
     and l.used_at is null
     and l.failed_attempts < 5
     and l.expires_at > now()
     and l.code_hash = public._portal_hash(l.token_hash || ':' || p_code)
   order by l.created_at desc
   limit 1;
  if v_id is null then
    update public.portal_links
       set failed_attempts = failed_attempts + 1
     where email = v_email and used_at is null and expires_at > now();
    return null;
  end if;
  update public.portal_links set used_at = now() where id = v_id;
  if not exists (select 1 from public._portal_customer_ids(v_email)) then
    return null;
  end if;
  return public._portal_new_session(v_email);
end;
$$;

revoke execute on function public.portal_request_link(text, text, text, text) from public;
revoke execute on function public.portal_sign_in_code(text, text) from public;
grant execute on function public.portal_request_link(text, text, text, text) to anon, authenticated;
grant execute on function public.portal_sign_in_code(text, text) to anon, authenticated;
