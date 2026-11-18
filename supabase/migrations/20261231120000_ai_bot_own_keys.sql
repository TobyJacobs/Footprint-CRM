-- AI control room: each bot can use its own AI key (owner, 18 November 2026).
--
-- Plain-English summary:
-- * The team's members each have their own AI accounts (Claude, Grok). A
--   Claude or Grok bot can now name its own key in Netlify, e.g.
--   XAI_API_KEY_JACK, so its costs go to that account. Without one it uses
--   the company key (ANTHROPIC_API_KEY / XAI_API_KEY) as before.
-- * Only the key's NAME is stored here; the key itself lives only in Netlify.
-- * Only AI key names are allowed (ANTHROPIC_API_KEY_… for Claude bots,
--   XAI_API_KEY_… for Grok bots), so a bot can never be pointed at another
--   secret.
-- * Only an admin can choose which key a bot uses, so nobody can spend
--   someone else's credit. Anyone who can change the bot can clear it.

alter table public.ai_bots
  add column key_name text check (key_name is null or key_name ~ '^(ANTHROPIC|XAI)_API_KEY_[A-Z0-9_]{1,30}$');
alter table public.ai_bots
  add constraint ai_bots_key_matches_engine check (
    key_name is null
    or (engine = 'claude' and key_name like 'ANTHROPIC\_%')
    or (engine = 'grok' and key_name like 'XAI\_%'));

create function public._ai_bot_key_guard()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.key_name is not null
     and (tg_op = 'INSERT' or new.key_name is distinct from old.key_name)
     and auth.uid() is not null
     and not public.is_admin() then
    raise exception 'Only an admin can choose which key a bot uses';
  end if;
  return new;
end;
$$;
revoke execute on function public._ai_bot_key_guard() from public, anon, authenticated;

create trigger ai_bots_key_guard before insert or update on public.ai_bots
  for each row execute function public._ai_bot_key_guard();
