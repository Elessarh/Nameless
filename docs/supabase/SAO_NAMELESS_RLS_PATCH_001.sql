-- SAO Nameless RLS Patch 001
-- Purpose:
--   Harden the legacy guild DM read policy currently stored in public.guild_chat.
--
-- Context:
--   The frontend still uses public.guild_chat for guild direct messages
--   (is_private = true). The policy name is therefore confusing, but the policy
--   is intentionally attached to guild_chat for compatibility with js/guild-dm.js.
--
-- Risk fixed:
--   Before this patch, a sender or recipient could still read legacy guild DMs
--   even after losing guild access. This patch keeps sender/recipient ownership
--   checks and also requires current guild access.
--
-- Apply manually in Supabase SQL Editor after reviewing the impact.

begin;

drop policy if exists "users read own guild dm" on public.guild_chat;

create policy "users read own guild dm"
on public.guild_chat
for select
to authenticated
using (
  is_private = true
  and public.can_access_guild()
  and (user_id = auth.uid() or recipient_id = auth.uid())
);

commit;
