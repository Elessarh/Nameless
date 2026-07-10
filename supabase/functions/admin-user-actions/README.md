# admin-user-actions Edge Function

Server-side admin actions for the Nameless dashboard. The browser only sends
the admin's Supabase session JWT; all authority lives here.

There is **no official Minecraft verification**: the Microsoft → Minecraft
Services link is blocked (`403 Invalid app registration`), so the site only
handles a public Minecraft identity ("Minecraft détecté"). The old
`set_minecraft_verified` action now returns `action_disabled` (410).

## Actions

| Action | Input | Effect |
|---|---|---|
| `update_role` | `target_user_id`, `role` (`joueur`\|`membre`\|`admin`), optional `confirm_self_demote` | Updates `user_profiles.role` AND upserts `user_roles`. Refuses removing the last admin; self-demotion requires `confirm_self_demote: true`. |
| `delete_user` | `target_user_id`, optional `confirm_self_delete` | Removes the player's Storage objects, then deletes the Supabase Auth user. Public data is removed by `on delete cascade`. Refuses deleting the last admin; self-deletion requires `confirm_self_delete: true`. |

Every action:

1. reads the JWT from the `Authorization` header;
2. resolves the caller with `auth.getUser(token)`;
3. checks the caller's effective role server-side (`user_roles` first,
   `user_profiles.role` fallback — same rule as `current_user_role()`);
4. refuses with `admin_required` if the caller is not admin;
5. writes an `admin_logs` entry (a failed log insert never blocks the action);
6. logs only safe fields (masked ids, error codes) — never tokens or keys.

## Error codes returned to the browser

`missing_env` (with `missing` field), `missing_user_session`,
`invalid_user_session`, `admin_required`, `invalid_target_user_id`,
`invalid_role`, `target_user_not_found`,
`self_downgrade_confirmation_required`, `self_delete_requires_confirmation`,
`cannot_remove_last_admin`, `cannot_delete_last_admin`, `role_update_failed`,
`auth_delete_blocked_by_storage`, `auth_delete_failed`, `action_disabled`,
`unknown_action`, `internal_error`.

No request path returns a bare 500 without a JSON body: the whole handler is
wrapped in a global try/catch and every response carries CORS +
`Content-Type: application/json`. `OPTIONS` returns 200.

## Hard delete vs soft delete

`delete_user` is a **hard delete**: the Auth account and all cascading public
rows disappear. `admin_logs` survives as audit (actor/target become null via
`on delete set null`). If a reversible removal is wanted later, add a
`disabled` flag on `user_profiles` instead of calling this action.

## Required secrets (Supabase dashboard or `supabase secrets set`)

```text
SERVICE_ROLE_KEY=   # service role key — Edge Function ONLY, never in the front
```

`SUPABASE_URL` is provided automatically. Never commit real values. If a
variable is missing the function answers
`{"error":"missing_env","missing":"SERVICE_ROLE_KEY"}` instead of crashing.

## Deploy

```bash
npx supabase functions deploy admin-user-actions --no-verify-jwt --project-ref iwrvdntlrjnoqzbwbsfm
```

`--no-verify-jwt` only disables the gateway check; the function still verifies
the JWT and the admin role itself on every request.
