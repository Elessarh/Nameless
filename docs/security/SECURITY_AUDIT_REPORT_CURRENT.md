# Security Audit Report Current

Date: 2026-07-09
Project: Nameless
Supabase project ref: `iwrvdntlrjnoqzbwbsfm`

## Summary

Current recommendation: keep the site as a progressive static SPA for public pages, but keep all authority in Supabase RLS/RPC. Admin and guild access must be decided by `public.current_user_role()`, not by button visibility, localStorage, or `user_profiles.role` alone.

Status: ready for manual Supabase tests after applying the proposed SQL patch `docs/supabase/SAO_NAMELESS_SECURITY_PATCH_002.sql`.

## Admin And Guild Findings

- Root cause 1: `/admin-dashboard` and `/espace-guilde` were missing from `js/page-registry.js`, so SPA fallback navigation could load a route without the protected page lifecycle.
- Root cause 2: admin/guild scripts used `DOMContentLoaded` only; when loaded by the SPA, that event had already fired, causing infinite loading.
- Root cause 3: the UI read `user_profiles.role`, while RLS/RPC uses `public.current_user_role()`, which checks `user_roles` first and then falls back to `user_profiles.role`.
- Root cause 4: some Supabase/RLS errors were swallowed, leaving spinners visible.

Fixes already committed:

- protected routes added to the registry;
- `init/destroy` lifecycle added for admin, guild, guild chat, and guild DM;
- role checks switched to `supabase.rpc('current_user_role')`;
- visible access errors replace infinite loading;
- admin role changes now sync `user_profiles` and `user_roles`.

## Correct Role Model

Roles used by Nameless:

- `joueur`: connected player, can fill their own player sheet.
- `membre`: guild member, can access the guild panel and guild chat.
- `admin`: admin, can access dashboard and guild panel.

Correct manual promotion in SQL Editor:

```sql
update public.user_profiles
set role = 'admin'
where username = 'MrFroton';

insert into public.user_roles (user_id, role, assigned_by)
select id, 'admin', null
from public.user_profiles
where username = 'MrFroton'
on conflict (user_id) do update
set role = excluded.role,
    assigned_by = excluded.assigned_by,
    updated_at = now();
```

Use `docs/supabase/SAO_NAMELESS_ROLE_DEBUG.sql` to compare `profile_role`, `user_roles_role`, and the effective role seen by RLS.

## Front Security Findings

Secret scan:

- No `service_role`, `sb_secret`, database password, connection string, Microsoft client secret, or hardcoded bearer token found in active HTML/JS/CSS.
- `SERVICE_ROLE_KEY` appears only inside the Supabase Edge Function environment access, not in browser code.
- The visible Supabase key in `js/supabase-public-config.js` is publishable and must be treated as public. The former misleading `crypto-keys.js` obfuscation has been removed.
- The old bad project ref `zhbuwwwvafbrrxpsupebt` is not present in active front files.

XSS/injection scan:

- No `onclick`, `onerror`, `onload`, or `href="javascript:"` found in active routed pages after this pass.
- Active admin/guild activity image rendering now uses `sanitizeImageUrl()`, enforcing HTTPS and allowed hosts.
- Active chat and DM messages are rendered with `createElement`/`textContent`.
- Remaining active `innerHTML` occurrences are static empty-state HTML or escaped templating. They remain watch points, but no raw user content was found going directly into `innerHTML`.
- PlayerDB/Minecraft username rendering is handled via existing profile code with regex validation and DOM/text rendering.

## RLS / RPC Findings

Safe:

- RLS is enabled in the schema for `user_profiles`, `user_roles`, guild tables, messages, market history, and storage.
- `user_roles` is protected by trigger and admin-only policies.
- `admin_logs` is admin-only.
- planning/objectives writes are admin-only.
- guild presence insert/update is own-user or admin.
- public guild chat insert requires `public.can_access_guild()`.
- private/message reads are scoped to sender/recipient/admin.

Needs patch:

- `user_profiles` read is currently `using (true)` for all authenticated users. This exposes profile/email data to any logged-in player.
- `guild_chat` private DM read allows sender/recipient even if the user no longer has guild access.
- guild private DM insert does not verify that `recipient_id` is a guild member/admin.
- `private_messages` has the same recipient-membership gap.

Proposed patch:

- `docs/supabase/SAO_NAMELESS_SECURITY_PATCH_002.sql`

Do not disable RLS. Apply the patch manually in Supabase SQL Editor, then run the verification queries in the patch and `SAO_NAMELESS_ROLE_DEBUG.sql`.

## Legacy / Cleanup

- `pages/hdv.html`, `js/hdv.js`, `js/hdv-supabase.js`, `js/mailbox.js`, and related HDV assets are still present as legacy.
- They are not registered in the SPA router and are not in the main navigation.
- The active wiki no longer exposes the HDV entry/content after this pass.
- No legacy files were deleted because HDV files are still internally referenced by `pages/hdv.html` and previous docs. Archive/removal should happen only after explicit validation.

## Manual Tests To Run

1. Apply `docs/supabase/SAO_NAMELESS_SECURITY_PATCH_002.sql`.
2. Run `docs/supabase/SAO_NAMELESS_ROLE_DEBUG.sql` with real `USER_ID` and `ADMIN_ID`.
3. Verify MrFroton has `admin` in both `user_profiles.role` and `user_roles.role`.
4. Verify a guild player has `membre` in both places.
5. Log in as normal `joueur`: profile works; admin/guild pages show access denied.
6. Log in as `membre`: guild page works; admin page denied.
7. Log in as `admin`: admin and guild pages work.
8. Try direct Supabase writes from DevTools as a normal user: guild chat/admin tables must fail.
9. Test XSS payloads in pseudo, chat, DM, activity title/content/image URL.

## Remaining Limits

- GitHub Pages static hosting cannot hide the Supabase URL or publishable key.
- CSP still uses `'unsafe-inline'` because pages contain inline styles/scripts; removing that requires a separate CSP refactor.
- HDV direct URL still exists as legacy. It is isolated from navigation/SPA, but full deletion/archive needs user validation.
- The Minecraft official Microsoft/Xbox link function remains blocked by Microsoft/Minecraft app registration; the current profile link is public Minecraft identity detection, not proof of ownership.
